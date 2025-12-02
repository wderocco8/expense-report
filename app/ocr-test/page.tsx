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
    const file = event.target.files?.[0] ?? null;
    if (file) {
      setFiles([file]);
    } else {
      setFiles([]);
    }
  };

  console.log("files", files);

  return (
    <div>
      <div className="grid w-full max-w-sm items-center gap-3">
        <Label htmlFor="receipt">Receipts</Label>
        <Input
          id="receipt"
          type="file"
          onChange={handleFileChange}
          accept="image/*"
        />
        <Button onClick={test}>Submit</Button>
      </div>
    </div>
  );
}
