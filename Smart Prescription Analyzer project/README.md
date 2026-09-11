# AI Resume Analyzer

An AI-powered resume analysis web application that analyzes resumes and provides ATS scoring, skill evaluation, project assessment, job-readiness insights, and suitable job department predictions.

## Project Overview

AI Resume Analyzer is a modern web application built to help candidates and HR teams evaluate resumes efficiently.

Users can upload a PDF or DOCX resume, and the application analyzes the resume to generate structured insights such as ATS score, skill match percentage, project evaluation, missing skills, suitable job roles, and an HR hiring summary.

## Features

- User signup and login
- Secure user dashboard
- PDF/DOCX resume upload
- Automatic resume text extraction
- AI-powered resume analysis
- ATS score (0–100)
- Job readiness score (0–100)
- Skill match percentage
- Technical skills analysis
- Soft skills analysis
- Tools and technologies detection
- Project evaluation
- Project level classification
- Project impact score
- Missing skill suggestions
- Suitable job department prediction
- Job role recommendations
- HR hiring summary
- Qualified / Not Qualified prediction
- Resume analysis history
- HR/Admin dashboard
- Candidate filtering
- Department-based filtering
- ATS score sorting
- Candidate qualification management
- Interactive charts and score meters
- Responsive design
- Dark and light theme
- Downloadable analysis report

## Job Departments

The system can analyze resumes and predict suitable departments such as:

- Frontend Development
- Backend Development
- Full Stack Development
- Data Science
- Machine Learning
- Artificial Intelligence
- DevOps
- UI/UX Design
- Software Testing / QA
- Other relevant technical roles

## Technologies Used

### Frontend

- React
- TypeScript
- Vite
- React Router
- Tailwind CSS
- shadcn/ui
- Radix UI
- Lucide React
- Recharts

### Backend & Database

- Supabase
- PostgreSQL
- Supabase Authentication
- Supabase Storage
- Supabase Edge Functions

### AI / Resume Processing

- AI-powered resume analysis
- PDF/DOCX text extraction
- ATS evaluation
- Skill matching
- Project evaluation
- Job department prediction
- HR summary generation

## Project Structure

```text
ai-resume-analyzer/
├── public/
│   └── robots.txt
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── lib/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── supabase/
│   ├── functions/
│   ├── migrations/
│   └── config.toml
│
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts