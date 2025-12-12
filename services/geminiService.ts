import { GoogleGenAI } from "@google/genai";
import { GenerationConfig } from "../types";

// Helper: Ensure we always send raw Base64 bytes to the API, 
// even if the input is a remote URL (like the Unsplash demo image).
async function prepareImageForAPI(input: string): Promise<string> {
  // Case 1: Remote URL (http/https) -> Fetch and convert
  if (input.startsWith('http')) {
    try {
      const response = await fetch(input, { mode: 'cors' });
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          // remove "data:image/jpeg;base64," prefix
          resolve(res.split(',')[1]); 
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Image processing error:", e);
      throw new Error("Could not process source image. If using a demo image, ensure CORS is allowed.");
    }
  }

  // Case 2: Data URL (data:image/...) -> Strip prefix
  if (input.includes('base64,')) {
    return input.split('base64,')[1];
  }

  // Case 3: Raw Base64 or unknown -> Return as is
  return input;
}

// Retry wrapper for robustness against 500/503 errors and Timeouts
async function withRetry<T>(operation: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      // Retry on network errors, server errors (5xx), rate limits (429), or Timeouts (Deadline Exceeded)
      const errorMessage = error.message?.toLowerCase() || '';
      const isRetryable = 
        !error.status || 
        error.status >= 500 || 
        error.status === 429 ||
        errorMessage.includes('internal') || 
        errorMessage.includes('overloaded') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('network') ||
        errorMessage.includes('deadline') ||
        errorMessage.includes('timeout');

      if (isRetryable && i < retries) {
        console.warn(`Attempt ${i + 1} failed, retrying in ${delay}ms...`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1))); 
      } else {
        throw error; // Rethrow if not retryable or max retries reached
      }
    }
  }
  throw lastError;
}

// Helper to extract image from response
function extractImageFromResponse(response: any): string | null {
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    return null;
}

export const generateMarketingImage = async (
  base64Image: string, 
  userPrompt: string,
  config: GenerationConfig
): Promise<{ imageUrl: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const cleanBase64 = await prepareImageForAPI(base64Image);

  // Build the prompt based on configuration
  let stylePrompt = "Commercial, High Key, 8k Resolution, Sharp Focus.";
  if (config.blackAndWhite) {
    stylePrompt = "Black and White Photography, High Contrast, Noir Style, Ansel Adams aesthetic.";
  }

  let posePrompt = "The object being held (the product) MUST remain exactly as it appears. Ensure the hand grip is natural.";
  if (config.strictPose) {
    posePrompt += " STRICTLY mimic the exact arm angle, hand grip, and body posture of the reference image. Do not move the arm.";
  } else {
    posePrompt += " You have creative freedom with the pose. Analyze the product type and use your best judgement to select the most flattering angle, grip, and body posture to showcase it. Change the arm position to what sells this specific product best. Do not feel bound by the original posture.";
  }

  let facePrompt = "Replace the person with a professional model or character that fits the context.";
  if (config.keepFace) {
    facePrompt = "Keep the user's face and identity recognizable, but enhance lighting and skin texture for a professional look.";
  } else {
    facePrompt = `
    CRITICAL: FACE SWAP REQUIRED.
    You MUST COMPLETELY REPLACE the person's face. 
    The output MUST NOT look like the original person in the reference image.
    OBLITERATE the original identity.
    Change the model's ethnicity, gender, or age if necessary to ensure the identity is totally different. 
    The original face is strictly a placeholder.
    Use a professional model that fits the product context.
    `;
  }

  let locationPrompt = "";
  if (config.lockLocation) {
    locationPrompt = "Maintain the original background environment and geometry. Do not generate a new background, only enhance the existing one.";
  }

  let productPreservationPrompt = "The object held in the hand is the focus.";
  if (config.lockProduct) {
    productPreservationPrompt = `
    CRITICAL - PRODUCT PRESERVATION:
    The object held in the hand is a real commercial product. 
    You MUST preserve the PRODUCT TEXT, LOGOS, and LABEL DETAILS exactly as they appear in the reference image.
    Do not hallucinate new text on the label. Do not blur or distort the brand name.
    Treat the product pixels as ground truth.
    `;
  }

  const prompt = `
    Professional Product Photography. 
    Task: Transform this reference image into a high-end commercial advertisement.
    
    ${productPreservationPrompt}

    Product Integrity: ${posePrompt}
    Subject: ${facePrompt}
    Context/Background: ${userPrompt}. ${locationPrompt}
    Style: ${stylePrompt}
  `;

  // STRATEGY: Try Pro Model (High Quality) -> Fallback to Flash (Stability)
  try {
    return await withRetry(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-image-preview",
            contents: {
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
                ],
            },
            config: {
                imageConfig: { aspectRatio: "3:4", imageSize: "2K" },
            },
        });
        const img = extractImageFromResponse(response);
        if (!img) throw new Error("No image generated from Pro model");
        return { imageUrl: img };
    });
  } catch (error) {
    console.warn("Pro model failed, falling back to Flash...", error);
    
    // Fallback: Gemini 2.5 Flash Image
    // Note: Flash does not support 'imageSize', only 'aspectRatio'
    // Wrapped in retry for robustness
    try {
        return await withRetry(async () => {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-image",
                contents: {
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
                    ],
                },
                config: {
                    imageConfig: { aspectRatio: "3:4" },
                },
            });
            const img = extractImageFromResponse(response);
            if (!img) throw new Error("No image generated from Flash model");
            return { imageUrl: img };
        });
    } catch (fallbackError) {
        console.error("All generation attempts failed", fallbackError);
        throw fallbackError;
    }
  }
};

export const generateVariantImage = async (
  base64Image: string,
  setting: string,
  angle: string,
  customPrompt?: string,
  backgroundReferenceBase64?: string
): Promise<{ imageUrl: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const cleanBase64 = await prepareImageForAPI(base64Image);

  // Construct parts array
  const parts: any[] = [];
  
  // Detect if the requested angle typically implies removing the person (Flat Lay / Macro)
  // If not, we explicitly instruct to keep the person.
  const angleLower = angle.toLowerCase();
  const shouldKeepPerson = !angleLower.includes('flat lay') && !angleLower.includes('macro');

  let personInstruction = "";
  if (shouldKeepPerson) {
      personInstruction = `
      CRITICAL: HUMAN PRESENCE REQUIRED.
      The input image contains a person or hand holding the product. 
      You MUST RETAIN the person/hand in the output. 
      Do not remove the human element. 
      Adjust the person's pose to match the "${angle}" camera angle, but they must be present holding the product.
      `;
  }
  
  // 1. Text Prompt
  let finalPrompt = `
    Product Photography Remix.
    Task: Composite the product from the main image into a new scene.
    Object: Keep the main object/product from the input image exactly as is. Preserve text and logos.
    ${personInstruction}
    Camera Angle/Composition: ${angle}.
    Style: High resolution, photorealistic, advertising standard.
  `;

  if (customPrompt && customPrompt.trim().length > 0) {
      finalPrompt += `\nSpecific Setting Description: ${customPrompt}`;
  } else {
      finalPrompt += `\nSetting: ${setting}`;
  }

  if (backgroundReferenceBase64) {
      finalPrompt += `\nReference: Use the second image provided as a strict reference for the background style, color palette, and environment. Place the product into THIS environment.`;
  }

  parts.push({ text: finalPrompt });

  // 2. Main Product Image
  parts.push({ inlineData: { mimeType: "image/jpeg", data: cleanBase64 } });

  // 3. Optional Background Reference
  if (backgroundReferenceBase64) {
      const cleanRef = await prepareImageForAPI(backgroundReferenceBase64);
      parts.push({ inlineData: { mimeType: "image/jpeg", data: cleanRef } });
  }

  // STRATEGY: Try Pro Model -> Fallback to Flash
  try {
    return await withRetry(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-image-preview",
            contents: {
                parts: parts
            },
            config: {
                imageConfig: { aspectRatio: "3:4", imageSize: "1K" }
            }
        });
        const img = extractImageFromResponse(response);
        if (!img) throw new Error("No image from Pro model");
        return { imageUrl: img };
    });
  } catch (error) {
    console.warn("Pro model failed for variant, falling back to Flash...", error);

    try {
        // Fallback wrapped in retry
        return await withRetry(async () => {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-image",
                contents: {
                    parts: parts
                },
                config: {
                    imageConfig: { aspectRatio: "3:4" }
                }
            });
            const img = extractImageFromResponse(response);
            if (!img) throw new Error("No image from Flash model");
            return { imageUrl: img };
        });
    } catch (fallbackError) {
        console.error("Variant generation failed completely", fallbackError);
        throw fallbackError;
    }
  }
};

export const runBrandAgent = async (
  base64Image: string,
  task: 'persona' | 'creative' | 'copy' | 'targeting' | 'safety' | 'ab_test',
  previousContext?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const cleanBase64 = await prepareImageForAPI(base64Image);

  // Gemini 3 Pro specific instructions for "Deep Research" capabilities
  let systemInstruction = "You are an advanced Market Research AI Agent. You must engage in deep reasoning and multi-step verification. Do not guess. Use Google Search to find real-time, grounded facts to support every claim you make in your report.";
  let prompt = "";

  switch (task) {
    case 'persona':
      prompt = `
        PHASE 1: AUDIENCE PERSONA & RESONANCE
        Analyze the person/model in the image (approximate age, style, vibe, environment).
        1. PLAN: Identify the target demographic that would most likely resonate with this specific look.
        2. RESEARCH: Use Google Search to find consumer trends relevant to this demographic (e.g., search for "Gen Z wellness trends", "Millennial sustainable fashion consumer behavior", "Luxury skincare target audience").
        3. REPORT: Create a "Persona Brief". 
           - Name the persona (e.g., "Mindful Millennial", "Urban Hypebeast").
           - Describe their values, shopping habits, and favorite social platforms.
           - Explain WHY the model in the photo appeals to them.
      `;
      break;
    case 'creative':
      prompt = `
        PHASE 2: NARRATIVE & SCENE DIRECTOR
        Context from previous step: ${previousContext}
        1. PLAN: Brainstorm visual narratives/scenes that appeal to the identified persona.
        2. RESEARCH: Use Google Search to find current visual trends in this niche (e.g. "skincare ad trends 2024", "biophilic design in advertising", "cyberpunk fashion editorial trends").
        3. REPORT: Provide a "Creative Brief". 
           - Suggest a specific scene setting, lighting, and mood to transform the original photo.
           - Explain WHY this visual direction connects with the persona.
           - IMPORTANT: End with a section labeled 'SCENE_PROMPT:' containing purely the visual description for the image generator.
      `;
      break;
    case 'copy':
      prompt = `
        PHASE 3: AUTHENTIC VOICE COPYWRITING
        Context from previous step: ${previousContext}
        1. PLAN: Determine the tone of voice (e.g. UGC, testimonial, authentic, witty).
        2. RESEARCH: Use Google Search to find real reviews and social captions for similar products to capture authentic language, slang, and pain points.
        3. REPORT: Generate a "Copy Kit" with 2 Hooky Headlines and 1 Call to Action.
           - Format the output exactly like this at the end:
           HEADLINE: [Your best headline]
           CTA: [Your best CTA]
      `;
      break;
    case 'targeting':
      prompt = `
        PHASE 4: INFLUENCER & COMMUNITY BLUEPRINT
        Context from previous step: ${previousContext}
        1. PLAN: Identify where this persona hangs out online.
        2. RESEARCH: Use Google Search to find specific micro-influencers, trending hashtags, and online communities (Subreddits, FB groups) relevant to this persona and product category.
        3. REPORT: Create a "Targeting Blueprint". 
           - List 3 specific influencers/creators to target.
           - List 5 relevant hashtags.
           - List 2 specific online communities or media outlets.
      `;
      break;
    case 'safety':
      prompt = `
        PHASE 5: REPRESENTATION & BRAND SAFETY
        Analyze the campaign concept and image for inclusivity and bias.
        1. PLAN: Check against inclusive marketing best practices.
        2. RESEARCH: Use Google Search to find "inclusive marketing guidelines 2024" or specific cultural sensitivities if applicable.
        3. REPORT: Provide a "Brand Safety Check".
           - Highlight how the ad positively represents the persona.
           - Suggest 1 opportunity for broader inclusivity in future campaigns (e.g. different skin tones, abilities, ages).
      `;
      break;
    case 'ab_test':
      prompt = `
        PHASE: A/B TEST CHALLENGER DISCOVERY
        1. RESEARCH: Search for "trending product photography styles 2024" or high-performing ad aesthetics for this specific type of object/product.
        2. SELECT: Pick ONE distinct, high-impact visual style that contrasts strongly with a standard studio shot.
        3. OUTPUT: Provide ONLY the visual description of the scene (e.g. "floating in zero gravity with neon particles"). Do not write "The visual style is...". Just the description text.
      `;
      break;
  }

  try {
    // UPGRADED TO gemini-3-pro-preview for DEEP RESEARCH capabilities
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } }
        ]
      },
      config: {
        tools: [{ googleSearch: {} }], 
        systemInstruction
      }
    });
    
    // Check for grounding chunks if needed, but text usually integrates it.
    // If googleSearch is used, the response text will contain the synthesized answer.
    return response.text || "Agent failed to return a report.";
  } catch (e) {
    console.error("Brand Agent Error:", e);
    // Fallback message if search fails or model errors
    return "Agent is offline or encountered a network error during deep research. Please try again.";
  }
};