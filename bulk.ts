import "dotenv/config";
import { Midjourney } from "./src";
import fs from "fs";
import readline from "readline";
import sharp from "sharp";
import axios from "axios";
import path from "path";
const client = new Midjourney({
  ServerId: <string>process.env.SERVER_ID,
  ChannelId: <string>process.env.CHANNEL_ID,
  SalaiToken: <string>process.env.SALAI_TOKEN,
  Debug: true,
  Ws: false,
});

/**
 *
 * a simple example of how to use the imagine command
 * ```
 * npx tsx example/imagine.ts
 * ```
 */

async function downloadAndSplitImage(
  imageUrl: string,
  outputDir: string,
  index: number
): Promise<void> {
  try {
    // 이미지 다운로드
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });
    const buffer = Buffer.from(response.data, "binary");

    // 이미지 메타데이터 가져오기
    const metadata = await sharp(buffer).metadata();
    const { width, height } = metadata;

    if (!width || !height) {
      throw new Error("이미지 크기를 확인할 수 없습니다.");
    }

    // 이미지를 4등분으로 자르기 위한 크기 계산
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);

    // 4개의 부분으로 자르고 저장
    const parts = [
      { left: 0, top: 0 },
      { left: halfWidth, top: 0 },
      { left: 0, top: halfHeight },
      { left: halfWidth, top: halfHeight },
    ];

    for (let i = 0; i < parts.length; i++) {
      const { left, top } = parts[i];
      await sharp(buffer)
        .extract({ left, top, width: halfWidth, height: halfHeight })
        .toFile(path.join(outputDir, `${index}_${i + 1}.jpg`));
    }

    console.log("이미지 처리가 완료되었습니다.");
  } catch (error) {
    console.error("이미지 처리 중 오류가 발생했습니다:", error);
  }
}

async function generate(prompt: string, index: number) {
  const msg = await client.Imagine(
    prompt,
    (uri: string, progress: string) => {
      console.log("loading", uri, "progress", progress);
    }
  );
  console.log(msg?.uri);
  await downloadAndSplitImage(
    msg!.uri,
    "/Users/planningo/planningo/midjourney-api/outputs",
    index
  );
}

async function processCsvFile(
  filePath: string,
  processRow: (row: string, index: number) => Promise<void>
): Promise<void> {
  const fileStream = fs.createReadStream(filePath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  let index = 0;

  for await (const line of rl) {
    // const row = line.split(",").map((item) => item.trim());
    if (index <= 16) {
      index++;
      continue;
    } else {
      console.log("prompt: ", line);
      await processRow(line, index);
      index++;
    }
  }
}

// 사용 예시
async function main() {
  const filePath =
    "/Users/planningo/Downloads/product_photography_prompts_10.csv";

  await processCsvFile(filePath, generate);

  console.log("All rows processed");
}

// main().catch(console.error);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
