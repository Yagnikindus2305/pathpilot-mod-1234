export interface RoleSkillData {
  must: string[];
  nice: string[];
  advanced: string[];
  salaryLPA: { min: number; max: number };
}

export const ENTRY_LEVEL_ROLE = 'Entry-Level / Trainee Associate';

export const ROLE_SKILLS: Record<string, RoleSkillData> = {
  'Full Stack Developer': {
    must: ['JavaScript', 'React', 'Node.js', 'HTML', 'CSS', 'REST APIs', 'Git', 'SQL'],
    nice: ['TypeScript', 'Redux', 'Docker', 'MongoDB', 'Jest', 'Tailwind CSS'],
    advanced: ['Microservices', 'GraphQL', 'Kubernetes', 'AWS', 'CI/CD', 'System Design'],
    salaryLPA: { min: 6, max: 18 },
  },
  'Frontend Developer': {
    must: ['JavaScript', 'React', 'HTML', 'CSS', 'Git', 'Responsive Design', 'DOM Manipulation'],
    nice: ['TypeScript', 'Redux', 'Tailwind CSS', 'Webpack', 'Jest', 'Figma'],
    advanced: ['Web Performance', 'PWA', 'Accessibility', 'Next.js', 'WebGL', 'Micro-frontends'],
    salaryLPA: { min: 5, max: 15 },
  },
  'Backend Developer': {
    must: ['Node.js', 'REST APIs', 'SQL', 'Git', 'PostgreSQL', 'Express', 'Authentication'],
    nice: ['TypeScript', 'MongoDB', 'Docker', 'Redis', 'Jest', 'GraphQL'],
    advanced: ['Microservices', 'Kubernetes', 'AWS', 'Kafka', 'System Design', 'Distributed Systems'],
    salaryLPA: { min: 6, max: 17 },
  },
  'Mobile App Developer': {
    must: ['JavaScript', 'React Native', 'Git', 'REST APIs', 'Mobile UI Design', 'State Management', 'Redux'],
    nice: ['TypeScript', 'Flutter', 'Dart', 'Firebase', 'Jest', 'Expo'],
    advanced: ['Native Modules', 'Performance Optimization', 'CI/CD', 'App Store Deployment', 'Offline Sync', 'Animations'],
    salaryLPA: { min: 5, max: 16 },
  },
  'DevOps Engineer': {
    must: ['Linux', 'Docker', 'Git', 'CI/CD', 'AWS', 'Bash', 'Jenkins'],
    nice: ['Kubernetes', 'Terraform', 'Ansible', 'Python', 'Prometheus', 'Grafana'],
    advanced: ['Service Mesh', 'Istio', 'Multi-cloud', 'Security Automation', 'Chaos Engineering', 'GitOps'],
    salaryLPA: { min: 6, max: 20 },
  },
  'Cloud Engineer': {
    must: ['AWS', 'Linux', 'Networking', 'Docker', 'IaC'],
    nice: ['Terraform', 'Kubernetes', 'Serverless', 'Python', 'Monitoring'],
    advanced: ['Cost Optimization', 'Security', 'Multi-cloud', 'Cloud Architecture', 'Disaster Recovery'],
    salaryLPA: { min: 7, max: 18 },
  },
  'QA / Test Engineer': {
    must: ['Manual Testing', 'Test Cases', 'SQL', 'Bug Tracking', 'Selenium'],
    nice: ['Automation Testing', 'API Testing', 'CI/CD', 'Cypress', 'Performance Testing'],
    advanced: ['Test Strategy', 'Security Testing', 'DevOps Testing', 'Mobile Testing', 'TDD'],
    salaryLPA: { min: 3, max: 9 },
  },
  'Data Analyst': {
    must: ['Excel', 'SQL', 'Statistics', 'Data Visualization', 'Python'],
    nice: ['Power BI', 'Tableau', 'Pandas', 'A/B Testing', 'Storytelling'],
    advanced: ['Big Data', 'ETL', 'Data Warehousing', 'Machine Learning', 'Automation'],
    salaryLPA: { min: 4, max: 12 },
  },
  'Data Scientist': {
    must: ['Python', 'SQL', 'Statistics', 'Machine Learning', 'Pandas', 'NumPy'],
    nice: ['TensorFlow', 'PyTorch', 'Jupyter', 'Git', 'Matplotlib'],
    advanced: ['Deep Learning', 'MLOps', 'Big Data', 'Cloud', 'Experiment Design'],
    salaryLPA: { min: 8, max: 20 },
  },
  'Machine Learning Engineer': {
    must: ['Python', 'Machine Learning', 'TensorFlow', 'PyTorch', 'SQL', 'Statistics'],
    nice: ['MLOps', 'Docker', 'Kubernetes', 'Jupyter', 'Model Deployment'],
    advanced: ['Distributed Training', 'GPU Optimization', 'LLMs', 'Computer Vision', 'NLP'],
    salaryLPA: { min: 8, max: 18 },
  },
  'AI Engineer': {
    must: ['Python', 'Deep Learning', 'NLP', 'PyTorch', 'LLMs', 'APIs'],
    nice: ['Vector Databases', 'Prompt Engineering', 'Model Deployment', 'Cloud AI', 'Data Pipelines'],
    advanced: ['RAG', 'MLOps', 'GPU Optimization', 'Computer Vision', 'Recommendation Systems'],
    salaryLPA: { min: 9, max: 22 },
  },
  'Data Engineer': {
    must: ['Python', 'SQL', 'ETL', 'Data Warehousing', 'Spark'],
    nice: ['Airflow', 'Kafka', 'dbt', 'Cloud (AWS/GCP)', 'Data Modeling'],
    advanced: ['Streaming', 'Data Lakes', 'Performance Tuning', 'Pipeline Automation', 'Observability'],
    salaryLPA: { min: 6, max: 14 },
  },
  'Cybersecurity Analyst': {
    must: ['Networking', 'Linux', 'Security Fundamentals', 'SIEM', 'Incident Response'],
    nice: ['Python', 'Threat Hunting', 'Cloud Security', 'Forensics', 'Compliance'],
    advanced: ['Malware Analysis', 'Zero Trust', 'IAM', 'Automation', 'Security Architecture'],
    salaryLPA: { min: 5, max: 12 },
  },
  'Penetration Tester': {
    must: ['Networking', 'Linux', 'Kali Tools', 'OWASP', 'Scripting'],
    nice: ['Burp Suite', 'Metasploit', 'Report Writing', 'Web App Security', 'API Testing'],
    advanced: ['OSCP', 'Reverse Engineering', 'Threat Modeling', 'Cloud Security', 'Exploit Development'],
    salaryLPA: { min: 6, max: 16 },
  },
  'SOC Analyst': {
    must: ['Networking', 'SIEM', 'Log Analysis', 'Security Fundamentals'],
    nice: ['Threat Intelligence', 'Python', 'EDR', 'Playbooks', 'Cloud Security'],
    advanced: ['Incident Response', 'Automation', 'Forensics', 'Continuous Monitoring', 'Compliance'],
    salaryLPA: { min: 4, max: 10 },
  },
  'Product Manager': {
    must: ['Product Strategy', 'User Research', 'Roadmapping', 'Analytics', 'Communication'],
    nice: ['A/B Testing', 'Wireframing', 'Agile', 'Stakeholder Management', 'User Stories'],
    advanced: ['Go-to-Market', 'OKRs', 'Customer Interviews', 'Data-driven Decision Making', 'Leadership'],
    salaryLPA: { min: 12, max: 28 },
  },
  'Business Analyst': {
    must: ['Requirements Analysis', 'SQL', 'Excel', 'Documentation', 'Communication'],
    nice: ['Power BI', 'Wireframing', 'Data Analysis', 'Stakeholder Management', 'Process Mapping'],
    advanced: ['Business Case', 'Change Management', 'UAT', 'Analytics Strategy', 'Product Metrics'],
    salaryLPA: { min: 5, max: 12 },
  },
  'Project Manager': {
    must: ['Project Planning', 'Agile', 'Communication', 'Risk Management', 'Budgeting'],
    nice: ['JIRA', 'Scrum', 'Stakeholder Management', 'MS Project', 'Reporting'],
    advanced: ['PMP', 'Change Control', 'Resource Management', 'Cost Forecasting', 'Quality Management'],
    salaryLPA: { min: 8, max: 18 },
  },
  'Scrum Master': {
    must: ['Agile', 'Scrum', 'Facilitation', 'JIRA', 'Communication'],
    nice: ['Kanban', 'Metrics', 'Team Coaching', 'Servant Leadership', 'Sprint Planning'],
    advanced: ['Conflict Resolution', 'Scaled Agile', 'Continuous Improvement', 'Retrospectives', 'Roadmapping'],
    salaryLPA: { min: 8, max: 16 },
  },
  'UI/UX Designer': {
    must: ['Figma', 'Wireframing', 'Prototyping', 'User Research', 'Visual Design'],
    nice: ['Design Systems', 'Usability Testing', 'Interaction Design', 'Accessibility', 'HTML/CSS'],
    advanced: ['Design Strategy', 'Motion Design', 'Analytics', 'Personas', 'Service Design'],
    salaryLPA: { min: 4, max: 12 },
  },
  'Product Designer': {
    must: ['Figma', 'UX Research', 'Prototyping', 'Design Systems', 'Visual Design'],
    nice: ['Interaction Design', 'Front-end Basics', 'Analytics', 'Usability Testing', 'Storytelling'],
    advanced: ['Design Leadership', 'Service Design', 'Product Strategy', 'Design Ops', 'Accessibility'],
    salaryLPA: { min: 6, max: 15 },
  },
  'Digital Marketer': {
    must: ['SEO', 'Social Media', 'Google Analytics', 'Content', 'Email Marketing'],
    nice: ['Paid Ads', 'Marketing Automation', 'CRO', 'Copywriting', 'Data Analysis'],
    advanced: ['Growth Marketing', 'Funnel Optimization', 'Brand Strategy', 'CRM', 'Lead Scoring'],
    salaryLPA: { min: 3, max: 9 },
  },
  'Content Writer': {
    must: ['Writing', 'Grammar', 'SEO Basics', 'Research', 'Editing'],
    nice: ['Copywriting', 'Content Strategy', 'WordPress', 'Keyword Research', 'Analytics'],
    advanced: ['Brand Voice', 'Content Planning', 'Storytelling', 'SEO Strategy', 'Newsletter Marketing'],
    salaryLPA: { min: 3, max: 7 },
  },
  'Financial Analyst': {
    must: ['Excel', 'Financial Modeling', 'Accounting', 'Valuation', 'Analysis'],
    nice: ['Power BI', 'SQL', 'Forecasting', 'Python', 'VBA'],
    advanced: ['Investment Analysis', 'Risk Management', 'Budgeting', 'M&A', 'Report Writing'],
    salaryLPA: { min: 4, max: 12 },
  },
  'HR Specialist': {
    must: ['Recruitment', 'Communication', 'HRMS', 'Onboarding', 'Employee Relations'],
    nice: ['Payroll', 'Labor Law', 'Excel', 'HR Analytics', 'Performance Management'],
    advanced: ['Talent Management', 'Compensation', 'HR Strategy', 'Employee Engagement', 'Conflict Resolution'],
    salaryLPA: { min: 3, max: 8 },
  },
  'Operations Analyst': {
    must: ['Excel', 'Process Improvement', 'SQL', 'Analysis', 'Reporting'],
    nice: ['Six Sigma', 'Power BI', 'Supply Chain', 'Automation', 'Lean'],
    advanced: ['ERP', 'Inventory Modeling', 'Forecasting', 'KPI Tracking', 'Optimization'],
    salaryLPA: { min: 4, max: 10 },
  },
  'Chartered Accountant': {
    must: ['Accounting Standards', 'Taxation', 'Auditing', 'Financial Reporting', 'Excel'],
    nice: ['GST', 'Tally', 'Cost Accounting', 'Direct Tax', 'Companies Act'],
    advanced: ['SAP FICO', 'International Taxation', 'Forensic Accounting', 'Transfer Pricing', 'IFRS'],
    salaryLPA: { min: 6, max: 15 },
  },
  'Investment Banker': {
    must: ['Financial Modeling', 'Valuation', 'Excel', 'PowerPoint', 'Accounting'],
    nice: ['DCF Analysis', 'M&A Analysis', 'Pitch Books', 'Comparable Company Analysis', 'LBO Modeling'],
    advanced: ['Bloomberg Terminal', 'Capital Markets', 'Deal Structuring', 'Due Diligence', 'Industry Research'],
    salaryLPA: { min: 8, max: 20 },
  },
  'Equity Research Analyst': {
    must: ['Financial Statement Analysis', 'Valuation', 'Excel', 'Industry Research', 'Financial Modeling'],
    nice: ['Equity Research Reports', 'DCF Analysis', 'Ratio Analysis', 'Bloomberg Terminal', 'Sector Analysis'],
    advanced: ['CFA Concepts', 'Portfolio Theory', 'Macroeconomic Analysis', 'Derivatives', 'Risk Modeling'],
    salaryLPA: { min: 6, max: 14 },
  },
  'Management Consultant': {
    must: ['Problem Solving', 'Excel', 'PowerPoint', 'Data Analysis', 'Client Communication'],
    nice: ['Case Analysis', 'Market Sizing', 'Business Strategy', 'Process Improvement', 'Frameworks'],
    advanced: ['Change Management', 'Digital Transformation', 'Operating Model Design', 'M&A Strategy', 'Stakeholder Management'],
    salaryLPA: { min: 8, max: 18 },
  },
  'Journalist': {
    must: ['News Writing', 'Research', 'Interviewing', 'Fact-Checking', 'AP Style'],
    nice: ['SEO Writing', 'Digital Publishing', 'Social Media', 'Photography', 'Video Reporting'],
    advanced: ['Investigative Journalism', 'Data Journalism', 'Multimedia Storytelling', 'Editorial Strategy', 'Audience Analytics'],
    salaryLPA: { min: 3, max: 8 },
  },
  'Social Media Manager': {
    must: ['Content Calendar', 'Copywriting', 'Analytics', 'Community Management', 'Canva'],
    nice: ['Paid Social Ads', 'Influencer Marketing', 'Video Editing', 'Brand Voice', 'Trend Research'],
    advanced: ['Social Media Strategy', 'Crisis Management', 'Marketing Automation', 'Cross-platform Campaigns', 'ROI Analysis'],
    salaryLPA: { min: 3, max: 9 },
  },
  'Entry-Level / Trainee Associate': {
    must: ['Communication', 'MS Office', 'Basic Computer Skills'],
    nice: ['Excel', 'Email Etiquette', 'Teamwork'],
    advanced: ['Time Management'],
    salaryLPA: { min: 1, max: 2 },
  },
};

const SKILL_RESOURCES: Record<string, string> = {
  'JavaScript': 'https://www.youtube.com/watch?v=W6NZfCO5SIk',
  'TypeScript': 'https://www.youtube.com/watch?v=BwuLxPH8IDs',
  'React': 'https://www.youtube.com/watch?v=w7ejDZ8SWv8',
  'Node.js': 'https://www.youtube.com/watch?v=Oe421EPjeBE',
  'Express': 'https://www.youtube.com/watch?v=L72fhGm1tfE',
  'HTML': 'https://www.youtube.com/watch?v=pQN-pnXPaVg',
  'CSS': 'https://www.youtube.com/watch?v=yfoY53QXEnI',
  'Tailwind CSS': 'https://www.youtube.com/watch?v=dFgzHOX84xQ',
  'Redux': 'https://www.youtube.com/watch?v=93p3LxR9xfM',
  'Git': 'https://www.youtube.com/watch?v=SWYqp7iY_Tc',
  'SQL': 'https://www.youtube.com/watch?v=HXV3zeQKqGY',
  'PostgreSQL': 'https://www.youtube.com/watch?v=qw--VYLpxG4',
  'MongoDB': 'https://www.youtube.com/watch?v=-56x56UppqQ',
  'Python': 'https://www.youtube.com/watch?v=_uQrJ0TkZlc',
  'Docker': 'https://www.youtube.com/watch?v=Gjnup-PuquQ',
  'Kubernetes': 'https://www.youtube.com/watch?v=X48VuDVv0do',
  'AWS': 'https://www.youtube.com/watch?v=3hLmDS179YE',
  'REST APIs': 'https://www.youtube.com/watch?v=Q-BpqyOT3a8',
  'GraphQL': 'https://www.youtube.com/watch?v=ed8SzALpx1Q',
  'Jest': 'https://www.youtube.com/watch?v=7r4xVDI2vho',
  'Webpack': 'https://www.youtube.com/watch?v=MpGLUVbqoYQ',
  'Linux': 'https://www.youtube.com/watch?v=wBp0Rb-ZJak',
  'Bash': 'https://www.youtube.com/watch?v=oxuRxtrO2Ag',
  'CI/CD': 'https://www.youtube.com/watch?v=h0S2IHG2bTI',
  'Terraform': 'https://www.youtube.com/watch?v=SLB_c_ayRMo',
  'Prometheus': 'https://www.youtube.com/watch?v=NsD15P0SzL0',
  'Grafana': 'https://www.youtube.com/watch?v=aJrnlbG1YZU',
  'Machine Learning': 'https://www.youtube.com/watch?v=Gv9_4yMHFhI',
  'TensorFlow': 'https://www.youtube.com/watch?v=tPYj3fFJGjk',
  'PyTorch': 'https://www.youtube.com/watch?v=GIsg-ZUy0MY',
  'Pandas': 'https://www.youtube.com/watch?v=vmEHCJofslg',
  'NumPy': 'https://www.youtube.com/watch?v=8Mpc9ukltVA',
  'Scikit-learn': 'https://www.youtube.com/watch?v=0Lt9w-BxKFQ',
  'Tableau': 'https://www.youtube.com/watch?v=5tc5t28Vy-s',
  'Power BI': 'https://www.youtube.com/watch?v=AGrl-H87pRU',
  'Figma': 'https://www.youtube.com/watch?v=4W4LvJnNegk',
  'SEO': 'https://www.youtube.com/watch?v=DvwS7cV9GmQ',
  'Content Strategy': 'https://www.youtube.com/watch?v=J1R1Vcd4uQE',
  'Copywriting': 'https://www.youtube.com/watch?v=QMIblvAZcHk',
  'Product Strategy': 'https://www.youtube.com/watch?v=Qc6QH4K2P5o',
  'Agile': 'https://www.youtube.com/watch?v=Z9QbYZh1YXY',
  'Design Systems': 'https://www.youtube.com/watch?v=1-7JMuPHIb8',
  'User Research': 'https://www.youtube.com/watch?v=4Gj7_XsmhHc',
  'Roadmapping': 'https://www.youtube.com/watch?v=xyv5e0Yf_6k',
  'Kali Tools': 'https://www.youtube.com/watch?v=F4HZe3-W9F4',
};

export function getSkillLink(skill: string) {
  return SKILL_RESOURCES[skill] || `https://www.youtube.com/results?search_query=${encodeURIComponent(skill + ' full course tutorial')}`;
}

export function getMissingSkills(detectedSkills: string[], targetRole: string): { skill: string; priority: 'Must Have' | 'Nice to Have' | 'Advanced'; link: string }[] {
  const req = ROLE_SKILLS[targetRole] || ROLE_SKILLS['Full Stack Developer'];
  const has = (s: string) => detectedSkills.some((d) => d.toLowerCase() === s.toLowerCase());
  const build = (skills: string[], priority: 'Must Have' | 'Nice to Have' | 'Advanced') =>
    skills.filter((s) => !has(s)).map((skill) => ({
      skill,
      priority,
      link: getSkillLink(skill),
    }));
  return [...build(req.must, 'Must Have'), ...build(req.nice, 'Nice to Have'), ...build(req.advanced, 'Advanced')];
}

export const DEFAULT_MILESTONES = [
  { key: 'complete_profile', label: 'Complete your profile' },
  { key: 'analyze_resume', label: 'Analyze your resume' },
  { key: 'complete_roadmap', label: 'Complete your skill roadmap' },
  { key: 'aptitude_70', label: 'Score 70%+ on an aptitude test' },
  { key: 'apply_10', label: 'Apply to 10 job roles' },
];
