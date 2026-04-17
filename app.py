from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
import pandas as pd
import io
import os

# Import the existing parser
from AccountingParser import AccountingParser

app = FastAPI(title="1C Accounting Parser App")

# Serve the frontend files from the "static" directory
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    try:
        with open("static/index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return JSONResponse(status_code=404, content={"message": "index.html not found"})

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        
        # Try to decode first with cp1251 (Windows Russian), fallback to utf-8
        try:
            raw_text = contents.decode("cp1251")
        except UnicodeDecodeError:
            raw_text = contents.decode("utf-8")
        
        parser = AccountingParser(raw_text)
        df_parsed = parser.parse()
        
        # Replace NaN/Infinity with None for JSON serialization
        df_parsed = df_parsed.fillna("")
        
        records = df_parsed.to_dict(orient="records")
        return {"filename": file.filename, "records": records, "count": len(records)}
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"message": f"Error parsing file: {str(e)}"}
        )
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port)   # без reload=True
