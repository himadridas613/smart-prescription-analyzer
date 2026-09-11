import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // -----------------------------------------
    // 1. Authentication
    // -----------------------------------------

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("Missing authorization");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Supabase environment variables are missing");
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const anonClient = createClient(
      supabaseUrl,
      anonKey
    );

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // -----------------------------------------
    // 2. Get Resume ID
    // -----------------------------------------

    const { resumeId } = await req.json();

    if (!resumeId) {
      throw new Error("Missing resumeId");
    }

    // -----------------------------------------
    // 3. Get Resume
    // -----------------------------------------

    const {
      data: resume,
      error: resumeError,
    } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", resumeId)
      .eq("user_id", user.id)
      .single();

    if (resumeError || !resume) {
      throw new Error("Resume not found");
    }

    // -----------------------------------------
    // 4. Download Resume
    // -----------------------------------------

    const {
      data: fileData,
      error: downloadError,
    } = await supabase.storage
      .from("resumes")
      .download(resume.file_path);

    if (downloadError || !fileData) {
      throw new Error("Could not download resume file");
    }

    // -----------------------------------------
    // 5. Extract Text
    // -----------------------------------------

    const text = await fileData.text();

    if (!text.trim()) {
      throw new Error("Could not extract text from resume");
    }

    // Limit input size
    const resumeText = text.substring(0, 15000);

    // -----------------------------------------
    // 6. Update Status
    // -----------------------------------------

    await supabase
      .from("resumes")
      .update({
        status: "analyzing",
      })
      .eq("id", resumeId)
      .eq("user_id", user.id);

    // -----------------------------------------
    // 7. Gemini API
    // -----------------------------------------

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const model = "gemini-2.5-flash";

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    // -----------------------------------------
    // 8. Gemini Structured Output Schema
    // -----------------------------------------

    const responseSchema = {
      type: "OBJECT",
      properties: {
        recommended_departments: {
          type: "ARRAY",
          items: {
            type: "STRING",
          },
        },

        ats_score: {
          type: "NUMBER",
        },

        job_readiness_score: {
          type: "NUMBER",
        },

        skill_match_percentage: {
          type: "NUMBER",
        },

        technical_skills: {
          type: "ARRAY",
          items: {
            type: "STRING",
          },
        },

        soft_skills: {
          type: "ARRAY",
          items: {
            type: "STRING",
          },
        },

        tools: {
          type: "ARRAY",
          items: {
            type: "STRING",
          },
        },

        certifications: {
          type: "ARRAY",
          items: {
            type: "STRING",
          },
        },

        projects: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              project_name: {
                type: "STRING",
              },

              level: {
                type: "STRING",
              },

              impact_score: {
                type: "STRING",
              },

              remarks: {
                type: "STRING",
              },
            },

            required: [
              "project_name",
              "level",
              "impact_score",
              "remarks",
            ],
          },
        },

        missing_skills: {
          type: "ARRAY",
          items: {
            type: "STRING",
          },
        },

        suggested_roles: {
          type: "ARRAY",
          items: {
            type: "STRING",
          },
        },

        hr_summary: {
          type: "STRING",
        },

        qualification_status: {
          type: "STRING",
          enum: [
            "qualified",
            "not_qualified",
          ],
        },
      },

      required: [
        "recommended_departments",
        "ats_score",
        "job_readiness_score",
        "skill_match_percentage",
        "technical_skills",
        "soft_skills",
        "tools",
        "certifications",
        "projects",
        "missing_skills",
        "suggested_roles",
        "hr_summary",
        "qualification_status",
      ],
    };

    // -----------------------------------------
    // 9. Gemini Request
    // -----------------------------------------

    const geminiResponse = await fetch(
      geminiUrl,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `
You are an expert HR analyst and ATS system.

Analyze the candidate's resume carefully.

Evaluate:
- Technical skills
- Soft skills
- Tools
- Certifications
- Projects
- Job readiness
- ATS compatibility
- Suitable departments
- Suitable job roles
- Missing skills

Be accurate and do not invent information that is not present in the resume.
Return only the requested structured JSON.
                `.trim(),
              },
            ],
          },

          contents: [
            {
              role: "user",

              parts: [
                {
                  text: `
Analyze the following resume.

Return a professional ATS analysis.

Recommended departments should contain 1-3 suitable departments such as:
Frontend, Backend, Full Stack, Data Science, Machine Learning, DevOps, UI/UX, Mobile, Cloud, QA, etc.

ATS score, job readiness score, and skill match percentage must be between 0 and 100.

Project impact score must be between 1 and 10.

Resume:

${resumeText}
                  `.trim(),
                },
              ],
            },
          ],

          generationConfig: {
            temperature: 0.2,

            responseMimeType: "application/json",

            responseSchema,
          },
        }),
      }
    );

    // -----------------------------------------
    // 10. Handle Gemini Errors
    // -----------------------------------------

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();

      console.error(
        "Gemini API error:",
        geminiResponse.status,
        errorText
      );

      if (geminiResponse.status === 429) {
        throw new Error(
          "Gemini rate limit exceeded. Please try again later."
        );
      }

      if (geminiResponse.status === 401) {
        throw new Error(
          "Invalid Gemini API key."
        );
      }

      if (geminiResponse.status === 403) {
        throw new Error(
          "Gemini API access is not enabled."
        );
      }

      throw new Error(
        "Gemini AI analysis failed."
      );
    }

    // -----------------------------------------
    // 11. Parse Gemini Response
    // -----------------------------------------

    const geminiData = await geminiResponse.json();

    const content =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error(
        "Invalid Gemini response:",
        JSON.stringify(geminiData)
      );

      throw new Error(
        "Gemini returned an empty response."
      );
    }

    let analysis;

    try {
      analysis = JSON.parse(content);
    } catch (parseError) {
      console.error(
        "JSON parsing error:",
        parseError,
        content
      );

      throw new Error(
        "Could not parse Gemini analysis."
      );
    }

    // -----------------------------------------
    // 12. Basic Validation
    // -----------------------------------------

    if (
      !Array.isArray(
        analysis.recommended_departments
      )
    ) {
      throw new Error(
        "Invalid AI response: recommended_departments"
      );
    }

    if (
      typeof analysis.ats_score !== "number"
    ) {
      throw new Error(
        "Invalid AI response: ats_score"
      );
    }

    if (
      typeof analysis.job_readiness_score !== "number"
    ) {
      throw new Error(
        "Invalid AI response: job_readiness_score"
      );
    }

    if (
      typeof analysis.skill_match_percentage !==
      "number"
    ) {
      throw new Error(
        "Invalid AI response: skill_match_percentage"
      );
    }

    // Clamp scores
    analysis.ats_score = Math.max(
      0,
      Math.min(100, analysis.ats_score)
    );

    analysis.job_readiness_score = Math.max(
      0,
      Math.min(
        100,
        analysis.job_readiness_score
      )
    );

    analysis.skill_match_percentage =
      Math.max(
        0,
        Math.min(
          100,
          analysis.skill_match_percentage
        )
      );

    // -----------------------------------------
    // 13. Save Analysis
    // -----------------------------------------

    const {
      data: savedAnalysis,
      error: saveError,
    } = await supabase
      .from("analyses")
      .insert({
        resume_id: resumeId,
        user_id: user.id,

        recommended_departments:
          analysis.recommended_departments || [],

        ats_score:
          analysis.ats_score || 0,

        job_readiness_score:
          analysis.job_readiness_score || 0,

        skill_match_percentage:
          analysis.skill_match_percentage || 0,

        technical_skills:
          analysis.technical_skills || [],

        soft_skills:
          analysis.soft_skills || [],

        tools:
          analysis.tools || [],

        certifications:
          analysis.certifications || [],

        projects:
          analysis.projects || [],

        missing_skills:
          analysis.missing_skills || [],

        suggested_roles:
          analysis.suggested_roles || [],

        hr_summary:
          analysis.hr_summary || "",

        qualification_status:
          analysis.qualification_status ||
          "not_qualified",
      })
      .select("id")
      .single();

    if (saveError) {
      console.error(
        "Database save error:",
        saveError
      );

      throw saveError;
    }

    // -----------------------------------------
    // 14. Mark Completed
    // -----------------------------------------

    await supabase
      .from("resumes")
      .update({
        status: "completed",
      })
      .eq("id", resumeId)
      .eq("user_id", user.id);

    // -----------------------------------------
    // 15. Success
    // -----------------------------------------

    return new Response(
      JSON.stringify({
        success: true,
        analysisId: savedAnalysis.id,
      }),
      {
        status: 200,

        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );

  } catch (error) {

    console.error(
      "analyze-resume error:",
      error
    );

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      }),
      {
        status: 500,

        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  }
});