# Connect your existing frontend

You now have two choices:

## Easiest
Use the included `index.html`. It is your original SkillSwap page with backend integration appended. Keep the backend running with `npm start`, then open `index.html` through VS Code Live Server (recommended).

## If you want to keep dbse1.html
Copy the contents of `frontend-integration.js` into the bottom of your HTML before `</body>`.
The integration overrides:
- registerUser()
- loginUser()
- saveProfile()
- submitRequest()

Then start the backend:
```bash
cd backend
npm install
npm start
```

The API is:
http://localhost:5000/api

For production, replace API_BASE with your deployed backend URL and serve the frontend from a web server.

Note: the backend uses `data.json` for immediate DB-like persistence. For a DBMS submission, it can be migrated to MySQL later.
