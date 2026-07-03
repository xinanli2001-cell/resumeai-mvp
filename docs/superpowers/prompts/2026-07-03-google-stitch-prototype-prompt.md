# Google Stitch 原型提示词

用途：给 Google Stitch 生成 AI 简历修改 SaaS 的可点击原型。  
状态：基于已确认 PRD，适合在工程实现前验证信息架构和页面流程。

```text
Create a high-fidelity interactive SaaS web app prototype for an AI resume rewriting tool for international students and new graduates.

Product concept:
The app helps users build a reusable personal information library, paste a target job description, get AI-recommended experiences from their library, review rewritten experience blocks, then enter a resume editor to assemble and export a tailored resume.

Important product rules:
- Do NOT include any resume scoring feature.
- The product should focus on JD-based experience matching, rewrite suggestions, user confirmation, resume editing, templates, and export.
- The smallest rewrite/review unit is one complete experience block, such as one project, one internship, or one work period. Do not make bullet points the primary confirmation unit.
- The user must confirm rewritten experience blocks before they enter the final resume editor.
- The personal information library must include basic information and contact details, not only project/work experiences.
- AI may suggest reasonable additions by default, but uncertain additions must be marked as “Needs user confirmation”.
- Add a separate “Packaging Mode” toggle. It is off by default. When turned on, show a truthfulness warning before generating stronger marketing-style rewrites.
- Support Chinese, English, and bilingual resume output.
- Free users have usage quota. Admin users have unlimited usage.

Visual direction:
Design a polished, modern productivity SaaS interface inspired by professional resume editors like WonderCV, but do not copy it exactly. Use a serious, work-focused layout. Prefer a dark left navigation/sidebar, clean light content panels, white resume preview canvas, subtle borders, compact information density, and a restrained accent color such as orange or blue for AI highlights. Avoid a marketing landing page. The first screen should feel like the actual app.

Create these screens and make the prototype clickable:

1. Login / Register
- Clean auth screen.
- Email and password fields.
- Links for login/register.
- After login, route to the personal information library.

2. Personal Information Library
Main purpose: maintain reusable resume assets.
Sections:
- Basic Info: name, location, target role, short summary.
- Contact: phone, email, LinkedIn, GitHub, personal website.
- Job Preferences: target city, visa/work authorization, language ability.
- Education.
- Project Experience.
- Internship Experience.
- Work Experience.
- Professional Skills.
Each project/internship/work entry should appear as a reusable card with title, time period, role, tags, skills, and last-used status.

Include a prominent “Import from text” button. Clicking it opens a modal where the user pastes raw experience text. Show an AI-parsed structured preview with editable fields and “Needs confirmation” badges before saving.

3. JD Input and Experience Recommendation
- Large job description input area.
- Parsed JD summary: role, responsibilities, required skills, nice-to-have skills, keywords.
- Experience library list below.
- AI-recommended experiences should be highlighted.
- Each highlighted recommendation should show matching reasons, such as “Python”, “data cleaning”, “B2B dashboard”, “cross-functional collaboration”.
- User can accept or remove recommended items.
- User can also manually select non-recommended experiences.
- Primary CTA: “Rewrite selected experiences”.

4. Rewrite Review Page
This is the key AI confirmation page before resume editing.
For each selected complete experience block, show:
- Original experience.
- AI rewritten version using STAR structure.
- Matching reason.
- Confirmed facts.
- “Needs user confirmation” additions.
- Buttons: Accept, Edit, Reject.
- Language selector: Chinese / English / Bilingual.
- Packaging Mode toggle, default off. If on, display warning: “Enhanced wording may require extra truthfulness review.”
Only accepted or edited blocks continue to the resume editor.

5. Resume Editor Page
Use a two-panel layout:
- Left panel: personal information library with basic info, contact, education, project, internship, work, skills. User can drag/add modules.
- Right panel: full resume preview on a white document canvas.
Top toolbar:
- Template selector.
- Font selector.
- Module management.
- Language switch.
- Save.
- Export PDF.
Resume preview should include realistic Chinese content:
Name: 李欣桉
Target role: AI / Backend / Data-related graduate role
Education: UNSW Artificial Intelligence, Beijing Institute of Technology Zhuhai
Projects: ABSA project, intelligent grid monitoring system, STM32 obstacle avoidance car
Internship: State Grid-related technical internship
Contact examples: email, phone, GitHub, website

6. Template Customization Panel
Accessible from the resume editor.
Allow users to customize:
- Module order.
- Show/hide modules.
- Font.
- Font size.
- Spacing.
- Accent color.
- Section title style.
- Header style.
Allow saving as “My Template”.
Do not support Word/PDF template upload in this MVP.

7. Minimal Admin Dashboard
- User list.
- Role: User / Admin.
- Quota limit.
- Quota used.
- Adjust quota.
- View generation records.
- Admin account should show “Unlimited usage”.

Prototype behavior:
- Use realistic mock data.
- Make navigation between screens clickable.
- Buttons, toggles, tabs, modals, selectors, and accept/edit/reject states should feel interactive.
- No backend or real AI integration is needed; simulate AI output with realistic mock content.
- Keep the UI dense but readable, like a serious professional tool.
- Do not create a public marketing homepage.
```
