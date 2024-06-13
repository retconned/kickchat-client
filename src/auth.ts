import { authenticator } from "otplib";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import "dotenv/config";

import { Config, ResStatus, TokenProviderResponse } from "./types/auth";

const config: Config = {
  username: process.env.username!,
  password: process.env.password!,
  otp_secret: process.env.OTP_SECRET!,
};

const generateOTP = (twoFaSecret: string): string => {
  if (!twoFaSecret.trim()) {
    throw new Error(
      "Missing 2FA authentication code! You need to provide it in the environment variable OTP_SECRET"
    );
  }

  return authenticator.generate(twoFaSecret);
};

export const getData = async () => {
  console.log("config", config);
  const puppeteerExtra = puppeteer.use(StealthPlugin()) as typeof puppeteer;
  const browser = await puppeteerExtra.launch({
    // headless if disabled for debugging purposes
    headless: false,
    devtools: true,
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(0);
  await page.goto(`https://kick.com/`);

  await page.waitForSelector("body");

  await page.setRequestInterception(true);

  try {
    const cookies = await page.cookies();
    let xsrfCookie = cookies.find((cookie) => cookie.name === "XSRF-TOKEN");
    let decodedXSRF = "";
    if (xsrfCookie) {
      decodedXSRF = decodeURIComponent(xsrfCookie.value);
    }
    console.log("🍪 decoded xsrfCookie string:", decodedXSRF);

    const response = await fetch("https://kick.com/kick-token-provider", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const kickTokenData: TokenProviderResponse = await response.json();
    const validFormKey = kickTokenData.encryptedValidFrom;

    console.log("🪵 pre payload one");

    // note: this should be the the first request to get authenticated , but sometimes it fails due to credentials not matching.
    // temp fix is to hardcode your email and password in the payload. (for debugging purposes only)

    const payloadOne = {
      isMobileRequest: true,
      email: config.username,
      password: config.username,
      [kickTokenData.nameFieldName]: "",
      [kickTokenData.validFromFieldName]: validFormKey,
    };

    const stringifiedPayload = JSON.stringify(payloadOne);

    const responseLoginOne = await fetch("https://kick.com/mobile/login", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-XSRF-TOKEN": decodedXSRF,
      },
      body: stringifiedPayload,
    });

    const loginResponse: ResStatus = await responseLoginOne.json();
    console.log("🧪 response one:", loginResponse);

    if (loginResponse["2fa_required"]) {
      const otp = generateOTP(config.otp_secret);

      const responseTokenP = await fetch(
        "https://kick.com/kick-token-provider",
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      const kickTokenData: TokenProviderResponse = await responseTokenP.json();
      const validFormKey = kickTokenData.encryptedValidFrom;

      console.log("🪵 pre payload two");

      const payloadTwo = {
        isMobileRequest: true,
        email: config.username,
        password: config.username,
        [kickTokenData.nameFieldName]: "",
        [kickTokenData.validFromFieldName]: validFormKey,
        one_time_password: otp,
      };

      const stringifiedPayloadTwo = JSON.stringify(payloadTwo);

      const response = await fetch("https://kick.com/mobile/login", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": decodedXSRF,
        },
        body: stringifiedPayloadTwo,
      });

      const responseTwo = await response.json();

      console.log(`🧪 response two:`, responseTwo);

      if (responseTwo) {
        console.log("✅ authorized successfully");

        // this is where we test auth success, so far no luck, fill with cookies and xsrf token too.
        // if auth'd successfully we would be able to get the follow list from said account

        // const responsePostLogin = await fetch(
        //   "https://kick.com/api/v2/channels/followed?cursor=0",
        //   {
        //     method: "GET",
        //     headers: {
        //       Accept: "application/json",
        //       "Content-Type": "application/json",
        //       "X-XSRF-TOKEN": ,
        //       cookie: ,
        //     },
        //   }
        // );

        // const resPost = await responsePostLogin.json();

        // console.log("👺resPost", resPost);
      }
    }

    // await browser.close();
  } catch (err: any) {
    throw err;
  }
};

const main = async () => {
  await getData();
};

main();
