Token Math (based on your data):
- ~24k tokens per receipt (input + output)
- 200k TPM limit ÷ 24k = ~8 concurrent receipts max
Current Setup (batchSize:5, maxConcurrency:5):
- 5 Lambdas × 5 receipts = 25 receipts "in flight"
- BUT receipts within a Lambda are processed sequentially (see for...of loop in index.ts)
- So max 5 concurrent OpenAI calls at any moment = 120k tokens
- This should fit within 200k TPM, but...
Why 429s happen:
The burst occurs when multiple Lambdas start simultaneously. Even with sequential processing per Lambda, if 5 Lambdas all start within a few seconds of each other, they hit OpenAI at nearly the same time.
Proposed Solution:
Option A: Conservative (Safer)
- maxConcurrency: 2, batchSize: 5
- Max 2 concurrent OpenAI calls = 48k tokens (very safe)
- Processing time for 40 receipts: ~40 × 3s avg ÷ 2 = ~60 seconds
Option B: Balanced (My recommendation)
- maxConcurrency: 5, batchSize: 2  
- Max 5 concurrent OpenAI calls = 120k tokens (safe with headroom)
- Processing time for 40 receipts: ~40 × 3s avg ÷ 5 = ~24 seconds
- Add 3 retries with exponential backoff (200ms, 400ms, 800ms) for 429s
- Add 100ms delay between receipts within a Lambda to smooth bursts
Option C: Aggressive (Higher risk)
- Keep current maxConcurrency: 5, batchSize: 5
- Implement token bucket rate limiting per Lambda
- More complex, but fastest processing