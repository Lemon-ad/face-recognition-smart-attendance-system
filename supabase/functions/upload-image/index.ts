import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// File size limit: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const IMGBB_API_KEY = Deno.env.get('IMGBB_API_KEY');
    
    if (!IMGBB_API_KEY) {
      throw new Error('ImgBB API key not configured');
    }

    const formData = await req.formData();
    const imageFile = formData.get('image');

    if (!imageFile || !(imageFile instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'No image file provided' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate file size
    if (imageFile.size > MAX_FILE_SIZE) {
      console.error(`File too large: ${imageFile.size} bytes`);
      return new Response(
        JSON.stringify({ 
          error: 'File too large',
          message: `Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          size: imageFile.size
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(imageFile.type)) {
      console.error(`Invalid file type: ${imageFile.type}`);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid file type',
          message: 'Only JPEG, PNG, and WebP images are allowed',
          receivedType: imageFile.type
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Uploading image: ${imageFile.name}, size: ${imageFile.size} bytes, type: ${imageFile.type}`);

    const imageBytes = await imageFile.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(imageBytes).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );

    const uploadFormData = new FormData();
    uploadFormData.append('image', base64Image);

    const imgbbResponse = await fetch(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
      {
        method: 'POST',
        body: uploadFormData,
      }
    );

    const imgbbData = await imgbbResponse.json();

    if (!imgbbResponse.ok) {
      console.error('ImgBB API error:', imgbbData);
      throw new Error(imgbbData.error?.message || 'Failed to upload image to ImgBB');
    }

    console.log('Image uploaded successfully:', imgbbData.data.url);

    return new Response(
      JSON.stringify({ 
        success: true,
        url: imgbbData.data.url,
        imageData: imgbbData.data 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in upload-image function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred',
        details: 'Failed to upload image'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});