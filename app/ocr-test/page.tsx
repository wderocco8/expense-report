"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export default function OcrTest() {
  const [files, setFiles] = useState<File[]>([]);

  const test = async () => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));

    const res = await fetch("/api/ocr-receipts", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    console.log("data", data);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setFiles([...files]);
    } else {
      setFiles([]);
    }
  };

  return (
    <div>
      <div className="grid w-full max-w-sm items-center gap-3">
        <Label htmlFor="receipt">Receipts</Label>
        <Input
          id="receipt"
          type="file"
          multiple
          onChange={handleFileChange}
          accept="image/*"
        />
        <Button onClick={test}>Submit</Button>
      </div>
    </div>
  );
}
