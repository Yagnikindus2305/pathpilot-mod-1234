import type { AtsBreakdown, AtsCategory, JobRoleMatch } from './types';
import { ENTRY_LEVEL_ROLE, ROLE_SKILLS, type RoleSkillData } from './roleSkills';
import richRolesData from '@/data/pathpilot_roles_rich.json';

const SKILL_KEYWORDS: Record<string, string[]> = {
  'JavaScript': ['javascript', 'js'],
  'TypeScript': ['typescript'],
  'React': ['react', 'reactjs', 'react.js'],
  'Node.js': ['node', 'nodejs', 'node.js'],
  'Express': ['express', 'expressjs'],
  'HTML': ['html', 'html5'],
  'CSS': ['css', 'css3', 'scss', 'sass'],
  'Tailwind CSS': ['tailwind', 'tailwindcss'],
  'Redux': ['redux'],
  'Git': ['git', 'github', 'gitlab', 'version control'],
  'SQL': ['sql', 'mysql', 'database'],
  'PostgreSQL': ['postgres', 'postgresql'],
  'MongoDB': ['mongo', 'mongodb', 'mongoose'],
  'Python': ['python', 'django', 'flask'],
  'Java': ['java', 'spring', 'springboot'],
  'C++': ['c++', 'cpp'],
  'Docker': ['docker', 'containerization'],
  'Kubernetes': ['kubernetes', 'k8s'],
  'AWS': ['aws', 'amazon web services', 'ec2', 's3', 'lambda'],
  'REST APIs': ['rest api', 'rest apis', 'restful api'],
  'GraphQL': ['graphql', 'apollo'],
  'Jest': ['jest', 'unit testing'],
  'Webpack': ['webpack', 'bundler'],
  'Linux': ['linux', 'unix'],
  'Bash': ['bash', 'shell script', 'shell scripting'],
  'CI/CD': ['ci/cd', 'continuous integration', 'continuous deployment', 'github actions'],
  'Jenkins': ['jenkins'],
  'Machine Learning': ['machine learning'],
  'Pandas': ['pandas', 'dataframe'],
  'NumPy': ['numpy'],
  'Scikit-learn': ['scikit-learn', 'sklearn', 'scikit'],
  'TensorFlow': ['tensorflow'],
  'PyTorch': ['pytorch'],
  'Statistics': ['statistics', 'probability'],
  'Data Visualization': ['data visualization', 'data viz'],
  'Tableau': ['tableau'],
  'Power BI': ['power bi', 'powerbi'],
  'Excel': ['excel', 'spreadsheet', 'vlookup', 'pivot table'],
  'R': ['r programming', 'rstudio', 'rstats'],
  'Matplotlib': ['matplotlib', 'seaborn', 'plotly'],
  'Jupyter': ['jupyter', 'colab'],
  'Flutter': ['flutter'],
  'Dart': ['dart'],
  'React Native': ['react native'],
  'Firebase': ['firebase'],
  'Network Security': ['network security', 'cybersecurity', 'infosec'],
  'Cryptography': ['cryptography', 'encryption'],
  'Penetration Testing': ['penetration testing', 'pentest', 'ethical hacking'],
  'Wireshark': ['wireshark'],
  'Nmap': ['nmap'],
  'Microservices': ['microservice', 'microservices'],
  'System Design': ['system design', 'scalability'],
  'Responsive Design': ['responsive design', 'mobile-first design'],
  'DOM Manipulation': ['dom manipulation'],
  'Authentication': ['authentication', 'jwt', 'oauth'],
  'Redis': ['redis'],
  'Kafka': ['kafka'],
  'Distributed Systems': ['distributed systems', 'distributed computing'],
  'NLP': ['nlp', 'natural language processing'],
  'Deep Learning': ['deep learning', 'neural network', 'cnn', 'rnn', 'lstm'],
  'MLOps': ['mlops', 'model deployment'],
  'Computer Vision': ['computer vision', 'opencv'],
  'Figma': ['figma'],
  'Accessibility': ['accessibility', 'wcag', 'a11y'],
  'PWA': ['progressive web app'],
  'Next.js': ['next.js', 'nextjs'],
  'Web Performance': ['web performance', 'lighthouse'],

  // Everything below covers the other 30+ curated roles (cybersecurity,
  // marketing, finance, HR, data, product, journalism, etc.) — these skill
  // names appear in ROLE_SKILLS as requirements but had no detection entry
  // at all, so no resume could ever satisfy them regardless of what it said
  // (e.g. a cybersecurity resume listing "SIEM" and "Incident Response"
  // verbatim would still show them as permanently missing). Most default to
  // matching the skill's own name; a few get extra aliases for how they're
  // commonly phrased or abbreviated on a resume.
  'A/B Testing': ['a/b testing', 'ab testing', 'split testing'],
  'AP Style': ['ap style'],
  'API Testing': ['api testing'],
  'APIs': ['apis'],
  'Accounting': ['accounting'],
  'Accounting Standards': ['accounting standards'],
  'Agile': ['agile'],
  'Airflow': ['airflow'],
  'Analysis': ['analysis'],
  'Analytics': ['analytics'],
  'Analytics Strategy': ['analytics strategy'],
  'Animations': ['animations'],
  'Ansible': ['ansible'],
  'App Store Deployment': ['app store deployment'],
  'Audience Analytics': ['audience analytics'],
  'Auditing': ['auditing'],
  'Automation': ['automation'],
  'Automation Testing': ['automation testing'],
  'Basic Computer Skills': ['basic computer skills'],
  'Big Data': ['big data'],
  'Bloomberg Terminal': ['bloomberg terminal'],
  'Brand Strategy': ['brand strategy'],
  'Brand Voice': ['brand voice'],
  'Budgeting': ['budgeting'],
  'Bug Tracking': ['bug tracking'],
  'Burp Suite': ['burp suite', 'burpsuite'],
  'Business Case': ['business case'],
  'Business Strategy': ['business strategy'],
  'CFA Concepts': ['cfa'],
  'CRM': ['crm', 'customer relationship management'],
  'CRO': ['cro', 'conversion rate optimization'],
  'Canva': ['canva'],
  'Capital Markets': ['capital markets'],
  'Case Analysis': ['case analysis'],
  'Change Control': ['change control'],
  'Change Management': ['change management'],
  'Chaos Engineering': ['chaos engineering'],
  'Client Communication': ['client communication'],
  'Cloud': ['cloud computing', 'cloud platform'],
  'Cloud (AWS/GCP)': ['aws', 'gcp', 'google cloud', 'azure'],
  'Cloud AI': ['cloud ai'],
  'Cloud Architecture': ['cloud architecture'],
  'Cloud Security': ['cloud security'],
  'Communication': ['communication'],
  'Community Management': ['community management'],
  'Companies Act': ['companies act'],
  'Comparable Company Analysis': ['comparable company analysis'],
  'Compensation': ['compensation'],
  'Compliance': ['compliance', 'regulatory compliance', 'gdpr', 'hipaa', 'pci-dss', 'soc 2', 'iso 27001'],
  'Conflict Resolution': ['conflict resolution'],
  'Content': ['content'],
  'Content Calendar': ['content calendar'],
  'Content Planning': ['content planning'],
  'Content Strategy': ['content strategy'],
  'Continuous Improvement': ['continuous improvement'],
  'Continuous Monitoring': ['continuous monitoring'],
  'Copywriting': ['copywriting'],
  'Cost Accounting': ['cost accounting'],
  'Cost Forecasting': ['cost forecasting'],
  'Cost Optimization': ['cost optimization'],
  'Crisis Management': ['crisis management'],
  'Cross-platform Campaigns': ['cross-platform campaigns'],
  'Customer Interviews': ['customer interviews'],
  'Cypress': ['cypress'],
  'DCF Analysis': ['dcf', 'discounted cash flow'],
  'Data Analysis': ['data analysis'],
  'Data Journalism': ['data journalism'],
  'Data Lakes': ['data lakes'],
  'Data Modeling': ['data modeling'],
  'Data Pipelines': ['data pipelines'],
  'Data Warehousing': ['data warehousing'],
  'Data-driven Decision Making': ['data-driven decision making'],
  'Deal Structuring': ['deal structuring'],
  'Derivatives': ['derivatives'],
  'Design Leadership': ['design leadership'],
  'Design Ops': ['design ops'],
  'Design Strategy': ['design strategy'],
  'Design Systems': ['design systems'],
  'DevOps Testing': ['devops testing'],
  'Digital Publishing': ['digital publishing'],
  'Digital Transformation': ['digital transformation'],
  'Direct Tax': ['direct tax'],
  'Disaster Recovery': ['disaster recovery'],
  'Distributed Training': ['distributed training'],
  'Documentation': ['documentation'],
  'Due Diligence': ['due diligence'],
  'EDR': ['edr', 'endpoint detection'],
  'ERP': ['erp', 'enterprise resource planning'],
  'ETL': ['etl', 'extract transform load'],
  'Editing': ['editing'],
  'Editorial Strategy': ['editorial strategy'],
  'Email Etiquette': ['email etiquette'],
  'Email Marketing': ['email marketing'],
  'Employee Engagement': ['employee engagement'],
  'Employee Relations': ['employee relations'],
  'Equity Research Reports': ['equity research reports'],
  'Experiment Design': ['experiment design'],
  'Exploit Development': ['exploit development'],
  'Expo': ['expo'],
  'Facilitation': ['facilitation'],
  'Fact-Checking': ['fact-checking'],
  'Financial Modeling': ['financial modeling'],
  'Financial Reporting': ['financial reporting'],
  'Financial Statement Analysis': ['financial statement analysis'],
  'Forecasting': ['forecasting'],
  'Forensic Accounting': ['forensic accounting'],
  'Forensics': ['forensics', 'digital forensics', 'forensic analysis'],
  'Frameworks': ['frameworks'],
  'Front-end Basics': ['front-end basics'],
  'Funnel Optimization': ['funnel optimization'],
  'GPU Optimization': ['gpu optimization'],
  'GST': ['gst', 'goods and services tax'],
  'GitOps': ['gitops'],
  'Go-to-Market': ['go-to-market'],
  'Google Analytics': ['google analytics'],
  'Grafana': ['grafana'],
  'Grammar': ['grammar'],
  'Growth Marketing': ['growth marketing'],
  'HR Analytics': ['hr analytics'],
  'HR Strategy': ['hr strategy'],
  'HRMS': ['hrms', 'human resource management system'],
  'HTML/CSS': ['html', 'css'],
  'IAM': ['iam', 'identity and access management'],
  'IFRS': ['ifrs', 'international financial reporting standards'],
  'IaC': ['iac', 'infrastructure as code'],
  'Incident Response': ['incident response', 'ir playbook'],
  'Industry Research': ['industry research'],
  'Influencer Marketing': ['influencer marketing'],
  'Interaction Design': ['interaction design'],
  'International Taxation': ['international taxation'],
  'Interviewing': ['interviewing'],
  'Inventory Modeling': ['inventory modeling'],
  'Investigative Journalism': ['investigative journalism'],
  'Investment Analysis': ['investment analysis'],
  'Istio': ['istio'],
  'JIRA': ['jira'],
  'KPI Tracking': ['kpi tracking', 'kpi', 'key performance indicators'],
  'Kali Tools': ['kali linux', 'kali tools'],
  'Kanban': ['kanban'],
  'Keyword Research': ['keyword research'],
  'LBO Modeling': ['lbo modeling'],
  'LLMs': ['llms'],
  'Labor Law': ['labor law'],
  'Lead Scoring': ['lead scoring'],
  'Leadership': ['leadership'],
  'Lean': ['lean'],
  'Log Analysis': ['log analysis'],
  'M&A': ['m&a', 'mergers and acquisitions'],
  'M&A Analysis': ['m&a analysis', 'mergers and acquisitions'],
  'M&A Strategy': ['m&a strategy', 'mergers and acquisitions'],
  'MS Office': ['ms office', 'microsoft office'],
  'MS Project': ['ms project'],
  'Macroeconomic Analysis': ['macroeconomic analysis'],
  'Malware Analysis': ['malware analysis'],
  'Manual Testing': ['manual testing'],
  'Market Sizing': ['market sizing'],
  'Marketing Automation': ['marketing automation'],
  'Metasploit': ['metasploit'],
  'Metrics': ['metrics'],
  'Micro-frontends': ['micro-frontends'],
  'Mobile Testing': ['mobile testing'],
  'Mobile UI Design': ['mobile ui design'],
  'Model Deployment': ['model deployment'],
  'Monitoring': ['monitoring'],
  'Motion Design': ['motion design'],
  'Multi-cloud': ['multi-cloud'],
  'Multimedia Storytelling': ['multimedia storytelling'],
  'Native Modules': ['native modules'],
  'Networking': ['networking', 'computer networks', 'tcp/ip', 'network protocols'],
  'News Writing': ['news writing'],
  'Newsletter Marketing': ['newsletter marketing'],
  'OKRs': ['okrs', 'objectives and key results'],
  'OSCP': ['oscp'],
  'OWASP': ['owasp', 'owasp top 10'],
  'Observability': ['observability'],
  'Offline Sync': ['offline sync'],
  'Onboarding': ['onboarding'],
  'Operating Model Design': ['operating model design'],
  'Optimization': ['optimization'],
  'PMP': ['pmp', 'project management professional'],
  'Paid Ads': ['paid ads'],
  'Paid Social Ads': ['paid social ads'],
  'Payroll': ['payroll'],
  'Performance Management': ['performance management'],
  'Performance Optimization': ['performance optimization'],
  'Performance Testing': ['performance testing'],
  'Performance Tuning': ['performance tuning'],
  'Personas': ['personas'],
  'Photography': ['photography'],
  'Pipeline Automation': ['pipeline automation'],
  'Pitch Books': ['pitch books'],
  'Playbooks': ['soar playbooks', 'security playbooks'],
  'Portfolio Theory': ['portfolio theory'],
  'PowerPoint': ['powerpoint'],
  'Problem Solving': ['problem solving'],
  'Process Improvement': ['process improvement'],
  'Process Mapping': ['process mapping'],
  'Product Metrics': ['product metrics'],
  'Product Strategy': ['product strategy'],
  'Project Planning': ['project planning'],
  'Prometheus': ['prometheus'],
  'Prompt Engineering': ['prompt engineering'],
  'Prototyping': ['prototyping'],
  'Quality Management': ['quality management'],
  'RAG': ['rag'],
  'ROI Analysis': ['roi analysis', 'return on investment'],
  'Ratio Analysis': ['ratio analysis'],
  'Recommendation Systems': ['recommendation systems'],
  'Recruitment': ['recruitment'],
  'Report Writing': ['report writing'],
  'Reporting': ['reporting'],
  'Requirements Analysis': ['requirements analysis'],
  'Research': ['research'],
  'Resource Management': ['resource management'],
  'Retrospectives': ['retrospectives'],
  'Reverse Engineering': ['reverse engineering'],
  'Risk Management': ['risk management'],
  'Risk Modeling': ['risk modeling'],
  'Roadmapping': ['roadmapping'],
  'SAP FICO': ['sap fico'],
  'SEO': ['seo', 'search engine optimization'],
  'SEO Basics': ['seo basics', 'search engine optimization'],
  'SEO Strategy': ['seo strategy', 'search engine optimization'],
  'SEO Writing': ['seo writing', 'search engine optimization'],
  'SIEM': ['siem', 'splunk', 'qradar', 'security information and event management'],
  'Scaled Agile': ['scaled agile'],
  'Scripting': ['scripting'],
  'Scrum': ['scrum'],
  'Sector Analysis': ['sector analysis'],
  'Security': ['security'],
  'Security Architecture': ['security architecture'],
  'Security Automation': ['security automation'],
  'Security Fundamentals': ['security fundamentals', 'information security', 'infosec fundamentals'],
  'Security Testing': ['security testing'],
  'Selenium': ['selenium'],
  'Servant Leadership': ['servant leadership'],
  'Serverless': ['serverless'],
  'Service Design': ['service design'],
  'Service Mesh': ['service mesh'],
  'Six Sigma': ['six sigma'],
  'Social Media': ['social media'],
  'Social Media Strategy': ['social media strategy'],
  'Spark': ['spark'],
  'Sprint Planning': ['sprint planning'],
  'Stakeholder Management': ['stakeholder management'],
  'State Management': ['state management'],
  'Storytelling': ['storytelling'],
  'Streaming': ['streaming'],
  'Supply Chain': ['supply chain'],
  'TDD': ['tdd', 'test-driven development'],
  'Talent Management': ['talent management'],
  'Tally': ['tally'],
  'Taxation': ['taxation'],
  'Team Coaching': ['team coaching'],
  'Teamwork': ['teamwork'],
  'Terraform': ['terraform'],
  'Test Cases': ['test cases'],
  'Test Strategy': ['test strategy'],
  'Threat Hunting': ['threat hunting'],
  'Threat Intelligence': ['threat intelligence', 'osint'],
  'Threat Modeling': ['threat modeling'],
  'Time Management': ['time management'],
  'Transfer Pricing': ['transfer pricing'],
  'Trend Research': ['trend research'],
  'UAT': ['uat', 'user acceptance testing'],
  'UX Research': ['ux research', 'user research'],
  'Usability Testing': ['usability testing'],
  'User Research': ['user research', 'ux research'],
  'User Stories': ['user stories'],
  'VBA': ['vba'],
  'Valuation': ['valuation'],
  'Vector Databases': ['vector databases'],
  'Video Editing': ['video editing'],
  'Video Reporting': ['video reporting'],
  'Visual Design': ['visual design'],
  'Web App Security': ['web application security', 'web app security'],
  'WebGL': ['webgl'],
  'Wireframing': ['wireframing'],
  'WordPress': ['wordpress'],
  'Writing': ['writing'],
  'Zero Trust': ['zero trust'],
  'dbt': ['dbt'],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsWord(lowerHaystack: string, keyword: string): boolean {
  const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(keyword.toLowerCase())}(?![a-z0-9])`, 'i');
  return pattern.test(lowerHaystack);
}

// Counts how many times a skill's keyword variants appear, so a skill demonstrated
// in both a Skills list and an Experience bullet outweighs one that's only listed
// once — the term-frequency half of a TF-IDF-style signal (role-tier below stands
// in for IDF, since there's no multi-resume corpus to compute real document frequency against).
function termFrequency(lowerHaystack: string, keywords: string[]): number {
  let count = 0;
  for (const kw of keywords) {
    const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(kw.toLowerCase())}(?![a-z0-9])`, 'gi');
    count += (lowerHaystack.match(pattern) || []).length;
  }
  return count;
}

// Diminishing-returns multiplier: the 2nd-3rd mention of a skill meaningfully
// strengthens its signal, but the 10th (keyword stuffing) barely moves it.
function frequencyBoost(occurrences: number): number {
  return Math.min(1.5, 1 + Math.log2(Math.max(1, occurrences)) * 0.25);
}

export function extractSkillsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const [skill, keywords] of Object.entries(SKILL_KEYWORDS)) {
    if (keywords.some((kw) => containsWord(lower, kw))) found.add(skill);
  }
  return Array.from(found);
}

// Rich role dataset (41 roles — same source the target-role picker and skill
// roadmap use) drives job-role matching. ROLE_SKILLS (a smaller, older list)
// only fills in roles the rich dataset doesn't have, e.g. the entry-level
// floor role. Without this merge, matching ran against ROLE_SKILLS alone,
// whose skill spellings/titles drift from the rich dataset — e.g. its
// "Penetration Tester" (Kali Tools, OWASP, Scripting...) barely overlaps with
// the roadmap skills a VAPT Analyst / Penetration Tester actually completes,
// so the "jobs you can target" list showed a low, wrongly-named match instead
// of the real target role at its real salary.
// "Penetration Tester" is dropped from the ROLE_SKILLS fallback specifically
// because the rich dataset's "VAPT Analyst / Penetration Tester" already
// supersedes it — keeping both would show two confusing near-duplicate rows.
const richRoleSkills: Record<string, RoleSkillData> = Object.fromEntries(
  (richRolesData as { roles: Array<{ title: string; requiredSkills?: string[]; tools?: string[]; advancedSkills?: string[]; salaryLPA?: { min: number; max: number } }> }).roles.map((role) => [
    role.title,
    {
      must: role.requiredSkills || [],
      nice: role.tools || [],
      advanced: role.advancedSkills || [],
      salaryLPA: role.salaryLPA || { min: 5, max: 15 },
    },
  ])
);
const ROLE_POOL: Record<string, RoleSkillData> = { ...richRoleSkills };
for (const [role, data] of Object.entries(ROLE_SKILLS)) {
  if (!ROLE_POOL[role] && role !== 'Penetration Tester') ROLE_POOL[role] = data;
}

const SALARY_RANGES: Record<string, [number, number]> = Object.fromEntries(
  Object.entries(ROLE_POOL).map(([role, info]) => [role, [info.salaryLPA.min, info.salaryLPA.max] as [number, number]])
);

function toJobRoleMatch(role: string, matchPct: number): JobRoleMatch {
  const [min, max] = SALARY_RANGES[role] || [5, 15];
  const avg = Math.round(((min + max) / 2) * 10) / 10;
  return { role, match: matchPct, salary_min: min, salary_max: max, salary_avg: avg };
}

export function calculateJobRoles(skills: string[]): JobRoleMatch[] {
  const scored: { role: string; match: number }[] = [];
  for (const [role, req] of Object.entries(ROLE_POOL)) {
    if (role === ENTRY_LEVEL_ROLE) continue;
    const allReq = [...req.must, ...req.nice, ...req.advanced];
    if (!allReq.length) continue;
    const matched = allReq.filter((s) => skills.includes(s)).length;
    const matchPct = Math.min(100, Math.round((matched / allReq.length) * 100));
    scored.push({ role, match: matchPct });
  }
  scored.sort((a, b) => b.match - a.match);

  const results = scored.filter((s) => s.match >= 20).map((s) => toJobRoleMatch(s.role, s.match));

  // Always surface at least one option: the best real match even if below the
  // 20% bar, so a resume with few detected skills isn't left with nothing.
  if (!results.length && scored.length) {
    results.push(toJobRoleMatch(scored[0].role, scored[0].match));
  }

  // Guarantee a low-bar, 1-2 LPA entry point regardless of skill level.
  const entryReq = ROLE_SKILLS[ENTRY_LEVEL_ROLE];
  const entryAllReq = [...entryReq.must, ...entryReq.nice, ...entryReq.advanced];
  const entryMatched = entryAllReq.filter((s) => skills.includes(s)).length;
  const entryMatchPct = Math.max(40, Math.min(100, Math.round((entryMatched / entryAllReq.length) * 100)));
  results.push(toJobRoleMatch(ENTRY_LEVEL_ROLE, entryMatchPct));

  return results.sort((a, b) => b.match - a.match);
}

const SECTION_GROUPS: Record<string, string[]> = {
  'Experience': ['experience', 'work history', 'employment history'],
  'Education': ['education', 'academic background'],
  'Skills': ['skills', 'technical skills', 'core competencies'],
  'Projects': ['projects', 'project experience'],
  'Summary/Objective': ['summary', 'objective', 'profile'],
  // A distinct Certifications section is a real, recruiter-visible signal
  // (AWS/OSCP/PMP-style credentials) that the previous 5 groups never
  // credited on its own — it only counted if it happened to overlap with
  // "Skills" keyword matching.
  'Certifications': ['certifications', 'certificates', 'licenses & certifications'],
};

const ACTION_VERBS = [
  'led', 'built', 'designed', 'developed', 'implemented', 'launched', 'improved', 'reduced',
  'increased', 'optimized', 'managed', 'created', 'architected', 'automated', 'delivered',
  'spearheaded', 'mentored', 'collaborated', 'deployed', 'migrated', 'streamlined', 'achieved',
  'drove', 'established', 'initiated', 'resolved', 'analyzed', 'presented', 'trained', 'organized',
];

const METRIC_PATTERN = /\b\d+(\.\d+)?\s?%|\$\s?\d[\d,]*|\b\d+\+\b|\b\d{2,}\b/g;
const ALL_SKILL_KEYWORDS = Object.values(SKILL_KEYWORDS).flat();

interface SectionSpan { group: string; text: string }

// Section headers are located in the original (position-preserving) text so each
// section's content can be scored on its own, rather than conflating an
// Experience bullet's action verbs with unrelated text elsewhere in the resume.
function segmentSections(lower: string, original: string): SectionSpan[] {
  const marks: { group: string; index: number }[] = [];
  for (const [group, kws] of Object.entries(SECTION_GROUPS)) {
    for (const kw of kws) {
      const match = new RegExp(`(?<![a-z0-9])${escapeRegExp(kw)}(?![a-z0-9])`, 'i').exec(lower);
      if (match) { marks.push({ group, index: match.index }); break; }
    }
  }
  marks.sort((a, b) => a.index - b.index);
  return marks.map((m, i) => ({
    group: m.group,
    text: original.slice(m.index, i + 1 < marks.length ? marks[i + 1].index : original.length),
  }));
}

// Each resume re-analysis is scored a notch tougher than the last, so a resume
// that hasn't actually improved sees its score drift down instead of staying flat.
function toughnessMultiplier(round: number): number {
  return Math.max(0.6, 1 - Math.max(0, round - 1) * 0.1);
}

export function calculateAtsScore(skills: string[], text: string, targetRole?: string, round: number = 1): { total: number; breakdown: AtsBreakdown } {
  const trimmed = (text || '').trim();
  const lower = trimmed.toLowerCase();
  const categories: AtsCategory[] = [];
  const warnings: string[] = [];
  const sections = segmentSections(lower, trimmed);

  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed);
  const hasPhone = /(\+?\d[\d\s().-]{8,15}\d)/.test(trimmed);
  categories.push({
    key: 'contact',
    label: 'Contact information',
    earned: (hasEmail ? 3 : 0) + (hasPhone ? 2 : 0),
    possible: 5,
    detail: `${hasEmail ? 'Email found' : 'No email found'} · ${hasPhone ? 'Phone number found' : 'No phone number found'}`,
  });

  const foundSections = Object.entries(SECTION_GROUPS).filter(([, kws]) => kws.some((kw) => containsWord(lower, kw)));
  categories.push({
    key: 'sections',
    label: 'Standard resume sections',
    earned: Math.round(foundSections.length * (15 / Object.keys(SECTION_GROUPS).length)),
    possible: 15,
    detail: foundSections.length ? `Found: ${foundSections.map(([group]) => group).join(', ')}` : 'No standard section headers (Experience, Education, Skills...) detected',
  });

  const multiplier = toughnessMultiplier(round);

  // ROLE_POOL (not the smaller ROLE_SKILLS) so a target role that only exists
  // in the rich dataset — e.g. "VAPT Analyst / Penetration Tester" — still gets
  // weighted skill-relevance scoring instead of silently falling back to the
  // generic "count of any recognizable skill" branch below.
  const roleData = targetRole ? ROLE_POOL[targetRole] : undefined;
  let skillsEarned: number;
  let skillsDetail: string;
  if (roleData) {
    const weightOf = (s: string) => (roleData.must.includes(s) ? 3 : roleData.nice.includes(s) ? 2 : roleData.advanced.includes(s) ? 1 : 0);
    const allReq = [...roleData.must, ...roleData.nice, ...roleData.advanced];
    const possibleWeight = roleData.must.length * 3 + roleData.nice.length * 2 + roleData.advanced.length * 1;
    const matchedReq = allReq.filter((s) => skills.includes(s));
    const earnedWeight = matchedReq.reduce((sum, s) => sum + weightOf(s) * frequencyBoost(termFrequency(lower, SKILL_KEYWORDS[s] || [s])), 0);
    const demonstrated = matchedReq.filter((s) => termFrequency(lower, SKILL_KEYWORDS[s] || [s]) > 1).length;
    skillsEarned = possibleWeight ? Math.max(0, Math.min(20, Math.round((earnedWeight / possibleWeight) * 20))) : 0;
    skillsDetail = `${matchedReq.length}/${allReq.length} ${targetRole} skills found in resume${demonstrated ? ` (${demonstrated} demonstrated more than once, weighted higher than a single mention)` : ''}`;
  } else {
    skillsEarned = Math.min(20, skills.length * 2);
    skillsDetail = `${skills.length} recognizable skills found (set a target role in your profile for a weighted match)`;
  }
  categories.push({ key: 'skillsMatch', label: 'Skills relevance', earned: Math.round(skillsEarned * multiplier), possible: 20, detail: skillsDetail });

  const metricMatches = lower.match(METRIC_PATTERN) || [];
  const achievementsEarned = Math.min(10, metricMatches.length * 2);
  categories.push({
    key: 'achievements',
    label: 'Quantifiable achievements',
    earned: Math.round(achievementsEarned * multiplier),
    possible: 10,
    detail: metricMatches.length ? `${metricMatches.length} number/metric mention(s) found (e.g. "40%", "500+ users")` : 'No quantified results (numbers, %, metrics) found',
  });

  const experienceSection = sections.find((s) => s.group === 'Experience');
  const experienceText = (experienceSection ? experienceSection.text : trimmed).toLowerCase();
  const experienceVerbs = ACTION_VERBS.filter((v) => containsWord(experienceText, v));
  const experienceMetrics = experienceText.match(METRIC_PATTERN) || [];
  const experienceClarityEarned = Math.min(15, experienceVerbs.length * 2 + experienceMetrics.length * 2);
  categories.push({
    key: 'experienceClarity',
    label: 'Experience clarity',
    earned: Math.round(experienceClarityEarned * multiplier),
    possible: 15,
    detail: experienceSection
      ? `${experienceVerbs.length} action verb(s) and ${experienceMetrics.length} quantified result(s) found in your Experience section`
      : `No dedicated Experience section found — scored from action verbs (${experienceVerbs.length}) and quantified results (${experienceMetrics.length}) across the whole resume`,
  });

  const projectsSection = sections.find((s) => s.group === 'Projects');
  if (projectsSection) {
    const projectText = projectsSection.text.toLowerCase();
    const techMentions = ALL_SKILL_KEYWORDS.filter((kw) => containsWord(projectText, kw)).length;
    const projectMetrics = projectText.match(METRIC_PATTERN) || [];
    const projectImpactEarned = Math.min(10, techMentions + projectMetrics.length * 2);
    categories.push({
      key: 'projectImpact',
      label: 'Project impact',
      earned: Math.round(projectImpactEarned * multiplier),
      possible: 10,
      detail: `${techMentions} technology mention(s) and ${projectMetrics.length} quantified outcome(s) found in your Projects section`,
    });
  } else {
    categories.push({
      key: 'projectImpact',
      label: 'Project impact',
      earned: 0,
      possible: 10,
      detail: 'No Projects section detected — add one with measurable outcomes (e.g. "reduced load time by 40%") to earn these points',
    });
  }

  const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  let lengthEarned: number;
  if (wordCount >= 300 && wordCount <= 900) lengthEarned = 10;
  else if (wordCount < 300) lengthEarned = Math.round((wordCount / 300) * 10);
  else lengthEarned = Math.max(4, 10 - Math.floor((wordCount - 900) / 400));
  categories.push({ key: 'length', label: 'Resume length', earned: lengthEarned, possible: 10, detail: `${wordCount} words (ideal range: 300-900)` });

  const noiseChars = (trimmed.match(/[^a-zA-Z0-9\s.,;:()\-_/&%$@'"!?]/g) || []).length;
  const noiseRatio = trimmed.length ? noiseChars / trimmed.length : 1;
  let formattingEarned = 15;
  if (noiseRatio > 0.15) formattingEarned = 0;
  else if (noiseRatio > 0.02) formattingEarned = Math.max(0, Math.round(15 - (noiseRatio - 0.02) * 90));
  categories.push({
    key: 'formatting',
    label: 'Parsing-friendly formatting',
    earned: formattingEarned,
    possible: 15,
    detail: noiseRatio > 0.15 ? 'A lot of unusual characters detected — likely a scanned image, tables, or a layout real ATS parsers struggle with' : 'No major formatting red flags detected',
  });

  if (trimmed.length < 150) {
    warnings.push('Extracted resume text is very short. This usually means the file is a scanned image or a layout that could not be parsed properly — the score below reflects that limited data, not necessarily your actual resume quality.');
  }

  if (round > 1) {
    warnings.push(`Round ${round} scoring is tougher than round 1 — the same content earns fewer points each round, so the only way back up is genuinely adding skills, metrics, and detail.`);
  }

  const total = Math.max(0, Math.min(100, categories.reduce((sum, c) => sum + c.earned, 0)));
  return { total, breakdown: { categories, warnings } };
}

export function analyzeResumeText(text: string, targetRole?: string, round: number = 1): {
  atsScore: number;
  skills: string[];
  jobRoles: JobRoleMatch[];
  breakdown: AtsBreakdown;
} {
  const skills = extractSkillsFromText(text);
  const { total, breakdown } = calculateAtsScore(skills, text, targetRole, round);
  const jobRoles = calculateJobRoles(skills);
  return { atsScore: total, skills, jobRoles, breakdown };
}
