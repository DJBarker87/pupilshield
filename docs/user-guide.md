# PupilSafe AI -- User Guide

---

## 1. What is PupilSafe AI?

PupilSafe AI is a browser-based tool that lets you use AI assistants like ChatGPT, Claude, and Gemini with your student data -- safely and legally. You paste or upload your class data, and PupilSafe AI replaces all student names with random fake names, flags anything that could identify a student, and generates a ready-to-use prompt. You copy that prompt into your AI tool, paste the AI's response back, and PupilSafe AI swaps the fake names back to real ones. The result: real, usable output with real student names -- and at no point did a single real name leave your browser.

**Core promise:** Paste your class data. Get AI-powered insights. Student names never leave your browser.

---

## 2. Why Do I Need This?

You already know that AI tools like ChatGPT are incredibly useful. They can analyse assessment data, write report comments, identify intervention groups, and generate differentiated resources in seconds. The problem is that student data is protected under UK GDPR, and your school almost certainly has a policy that says you must not paste student names, grades, SEN status, or behaviour notes into public AI tools.

That puts you in a bind. You either avoid AI entirely and miss out on the productivity gains, or you quietly paste student data in and hope for the best -- risking a data breach, your school's reputation, and potentially your career.

PupilSafe AI solves this by sitting between you and the AI. It anonymises your data before anything leaves your browser, and de-anonymises the AI's response afterwards. The AI only ever sees fake names and (optionally) slightly shifted numbers. You get back output with real names, ready to use.

No data is sent to any server. There is no backend, no database, and no account to create. Everything happens locally in your browser.

---

## 3. How It Works (Step by Step)

### Step 1: Paste or upload your class data

Copy your data from a spreadsheet (Excel, Google Sheets, or any other tool) and paste it directly into PupilSafe AI. You can also upload a CSV file. The tool automatically detects your columns -- names, scores, categories, and comments -- and asks you to confirm.

### Step 2: Choose your privacy mode

You will see two options:

- **Accurate Mode** -- names are replaced but all numbers stay exactly as they are.
- **Anonymous Mode** -- names are replaced and all numbers are shifted by a small random amount.

Choose the one that fits your needs. (See Section 4 below for detailed guidance on when to use each mode.)

### Step 3: Review the anonymised data

Before anything leaves your browser, PupilSafe AI shows you exactly what will be sent to the AI. You will see:

- The anonymised dataset with fake names
- Any flagged items in your comments or notes that might identify a student
- A risk summary telling you if any students could still be identifiable from their combination of attributes

Review the flagged items carefully. You are always the final reviewer.

### Step 4: Copy the prompt to your AI tool

Once you are happy, click the **Copy** button. This copies the anonymised data and a carefully written prompt to your clipboard. Open ChatGPT, Claude, Gemini, or whichever AI tool you prefer, and paste.

### Step 5: Paste the AI's response back

Copy the AI's entire response and paste it back into PupilSafe AI's "Translate Back" box.

### Step 6: Get your de-anonymised results

PupilSafe AI swaps all the fake names back to real student names and presents your final output. You can copy it, download it, or use it however you need.

The whole process takes under two minutes once you are familiar with it.

---

## 4. Privacy Modes Explained

### Accurate Mode -- "Names changed. Numbers exact."

**What changes:**
- All student names are replaced with randomly generated fake names
- Rows are shuffled into a random order
- Free-text fields (comments, notes) are scanned for identifying information

**What stays the same:**
- All scores, grades, percentages, and attendance figures are sent to the AI exactly as they are

**When to use it:**
- You need precise analysis (e.g. "which students scored below 40%?" or "what is the class average?")
- Your data is mostly scores and grades without particularly sensitive information
- You are comfortable that name replacement and row shuffling provide sufficient protection for your context

**Good to know:** If your class has fewer than 15 students, PupilSafe AI will suggest switching to Anonymous Mode. In small classes, unique score patterns can sometimes be identifying even without names.

---

### Anonymous Mode -- "Names changed. Numbers shifted."

**What changes:**
- Everything in Accurate Mode, plus...
- All numerical values (scores, percentages, attendance) are shifted by a small random amount -- typically a few points either way
- The shifts are calibrated so that overall patterns, trends, and rankings are preserved

**What stays the same:**
- Class-level statistics (averages, distributions, trends) remain accurate
- Students who are high performers stay near the top; those who are struggling remain visible
- Correlations between different measures are preserved

**Grade-boundary awareness:** This is one of the most important features. When numbers are shifted, a student at 39% will not be accidentally pushed to 41% (or the other way around). The tool is aware of grade boundaries and keeps each student within their current grade band. A student in the 30-39 range stays in the 30-39 range. This means the AI will not misclassify borderline students.

**When to use it:**
- Your data includes sensitive categories such as SEN status, behaviour records, Pupil Premium, or safeguarding notes
- You want maximum protection and are happy for the AI to work with patterns and trends rather than exact individual scores
- You are working with a small class where score patterns might be recognisable

**The trade-off:** Individual scores may be off by a few points, so you should not rely on the AI to give precise per-student recommendations based on exact numbers. For questions like "what are the overall trends?" or "which group of students needs the most support?", Anonymous Mode works very well.

---

## 5. What Gets Flagged?

Teacher comments and notes are often the most identifying part of a dataset. A comment like "Johnny's mother Mrs Smith called to discuss his ADHD diagnosis and the incident on the Year 9 trip to Thorpe Park" contains a name, a family relationship, a medical condition, a year group, and a specific event -- all potentially identifying even without the name column.

PupilSafe AI's free-text scanner automatically detects and flags:

- **Student names** appearing in comments (including first name only or surname only)
- **Medical and SEN terms** -- such as ADHD, autism, dyslexia, EHC plan, diagnosed, medication
- **Safeguarding terms** -- such as social services, CAMHS, looked-after, child protection
- **Family relationships** -- mother, father, brother, sister, parent, guardian, mum, dad, carer
- **Dates** in various formats (e.g. 15/03/2024)
- **UK postcodes, phone numbers, and email addresses**

You will see each flagged item highlighted so you can review it before proceeding.

### Before you proceed, check your text for:

- Place names and trip destinations (e.g. "the trip to Thorpe Park")
- Staff names or initials (e.g. "as discussed with Mrs Henderson")
- Sibling names (e.g. "her brother Kai")
- Specific diagnoses or medications
- Dates of unique incidents
- Anything else that could identify a student in context

**Important:** The scanner is a helper, not a guarantee. It catches the most common identifying information, but you are always the final reviewer. If you spot something the scanner missed, remove it before copying.

---

## 6. Understanding the Risk Analysis

Even after names are replaced and rows are shuffled, a student might still be identifiable if they have a unique combination of attributes. PupilSafe AI checks for this automatically.

### What is re-identification risk?

Imagine a class where only one student has an EHCP, receives Pupil Premium, and achieved top grades. Anyone who knows the class -- a colleague, a teaching assistant, even a student -- could look at the anonymised data and work out who that row belongs to, even though the name is fake.

This is called a "unique combination." The more attributes a student has that are rare in the class, the easier they are to pick out.

### What PupilSafe AI does about it

After anonymising your data, the tool checks each student's combination of key attributes -- such as gender, SEN status, Pupil Premium, EAL, grade band, and attendance band. If any student has a combination that is shared by very few (or no) other students, the tool warns you.

You will see a message like:

> "3 students have a unique combination of attributes. For example: only 1 student has EHCP + Pupil Premium + Grade 9-8. Someone familiar with the class could identify them even without names."

### What you can do

The tool may suggest **generalising** rare categories. For example, if only one student has "EHCP" in the SEN column, the tool might suggest changing it to "SEN: Yes" so that student blends in with others who have SEN support at any level.

You always have the final say. The tool never blocks you from proceeding -- it informs you so you can make a good decision. Your options include:

- **Generalise** the rare category (the tool offers a one-click option)
- **Remove** the sensitive column before sending to the AI
- **Switch to Anonymous Mode** so the numbers are shifted as well
- **Proceed as-is** if you are comfortable with the level of risk

This kind of analysis is something you simply cannot do manually. It is one of the main reasons to use PupilSafe AI rather than just doing Find and Replace on names in a spreadsheet.

---

## 7. Frequently Asked Questions

### "Is my data sent anywhere?"

No. Everything happens in your browser. There is no server, no database, and no backend. Your student data is never transmitted anywhere. When you close your browser, the data is gone.

### "Can the AI see my students' real names?"

No. The AI only ever sees randomly generated fake names. Real names are replaced before anything leaves your browser, and they are swapped back in after the AI responds.

### "What if the AI changes a student's name in its response?"

This is handled. Every student is assigned a short ID token (like [S01], [S02], and so on) as well as a fake name. The prompt instructs the AI to include these IDs whenever it refers to a student. Even if the AI slightly changes a fake name, the ID token allows PupilSafe AI to match the student reliably. You will never see these ID tokens in your final output -- they are stripped automatically after matching.

### "Is this GDPR compliant?"

PupilSafe AI helps you comply with GDPR by removing identifiable student data before it reaches any AI tool. It does not store, transmit, or process personal data on any server. However, no tool can guarantee compliance on its own -- you should always review the anonymised data before copying and follow your school's data protection policy.

### "Can I use this for sensitive data like SEN records?"

Yes. Use Anonymous Mode, which shifts numerical values in addition to replacing names. The tool will also flag sensitive terms in your comments and warn you about students who might be identifiable from their attribute combinations. For highly sensitive data, always review the risk analysis carefully and consider generalising rare categories.

### "What about students with unique characteristics?"

PupilSafe AI specifically checks for this. If a student has a unique combination of attributes (e.g. the only student with an EHCP in the class), the tool warns you and suggests ways to reduce the risk, such as generalising that category or removing the column. See Section 6 above for details.

### "Which AI tools does this work with?"

Any AI tool that accepts text input. ChatGPT, Claude, Gemini, Microsoft Copilot, and others all work. You simply paste the anonymised prompt into whichever tool you prefer and paste the response back.

### "Do I need to install anything?"

No. PupilSafe AI runs entirely in your browser. There is nothing to install, no accounts to create, and no software to download.

---

## 8. Tips for Best Results

- **Use Anonymous Mode for sensitive data.** If your dataset includes SEN status, behaviour notes, safeguarding information, or medical details, Anonymous Mode provides significantly stronger protection.

- **Always review flagged items before copying.** The scanner catches the most common identifying information, but it is not perfect. Spend a few seconds checking for anything it might have missed.

- **Watch out for place names and staff names.** Comments like "as discussed with Mrs Patel" or "the trip to Snowdonia" contain identifying details that the scanner may not always catch. Check your comments for these before proceeding.

- **Consider your class size.** In small classes (fewer than 15 students), unique score patterns and rare categories are more identifying. The tool will suggest Anonymous Mode for small classes -- it is usually a good idea to follow that suggestion.

- **Use the risk analysis.** If the tool tells you that certain students have unique attribute combinations, take a moment to review the suggestions. Generalising a single category can significantly improve privacy.

- **Keep the AI's response as-is when pasting back.** Copy the entire response from the AI and paste it without editing. PupilSafe AI needs the ID tokens and fake names intact to match everything back correctly.

- **You can use this with any AI tool.** PupilSafe AI is not tied to any specific AI provider. Use whichever tool your school allows or you personally prefer.

- **Close your browser when you are done.** All data is stored temporarily in your browser session. Closing the browser clears everything. Nothing persists.
