# PathPilot data files

Drop these 6 files into this folder (`server/data/`) exactly as named:

- `pathpilot_colleges.json`
- `pathpilot_courses.json`
- `pathpilot_roles_rich.json`
- `pathpilot_all_job_titles.json`
- `pathpilot_companies.json`
- `pathpilot_roles.json` (optional, unused by the current routes)

`server/routes/data.js` reads them once when the API starts (`npm run server`). If a
file is missing it logs a warning and serves empty data instead of crashing, so the
rest of the app keeps working while you add files one at a time.
