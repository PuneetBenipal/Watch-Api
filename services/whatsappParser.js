const crypto = require("crypto");
const Listing = require("../models/Listing");

// Try to import puppeteer, but make it optional
let puppeteer;
try {
  puppeteer = require("puppeteer");
} catch (error) {
  console.warn("Puppeteer not installed. WhatsApp parsing will be disabled.");
  puppeteer = null;
}

class WhatsAppParser {
  constructor() {
    this.browser = null;
    this.page = null;
    this.cookiesPath = require("path").join(
      __dirname,
      "../.whatsapp-cookies.json"
    );
  }

  async initialize() {
    try {
      if (!puppeteer) {
        console.warn("Puppeteer not available. WhatsApp parsing disabled.");
        return;
      }

      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
        ],
      });

      this.page = await this.browser.newPage();
      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      );

      // Load cookies if available for session persistence
      const fs = require("fs");
      try {
        if (fs.existsSync(this.cookiesPath)) {
          const cookies = JSON.parse(fs.readFileSync(this.cookiesPath, "utf8"));
          if (Array.isArray(cookies) && cookies.length > 0) {
            await this.page.setCookie(...cookies);
          }
        }
      } catch (e) {
        console.warn(
          "Failed to load WhatsApp cookies, continuing fresh session"
        );
      }

      console.log("WhatsApp Parser initialized successfully");
    } catch (error) {
      console.error("Failed to initialize WhatsApp Parser:", error);
      throw error;
    }
  }

  async parseGroupMessages(groupId, messageSelector = ".message-in") {
    try {
      if (!puppeteer) {
        console.warn(
          "Puppeteer not available. Cannot parse WhatsApp messages."
        );
        return [];
      }

      if (!this.page) {
        await this.initialize();
      }

      // Navigate to WhatsApp Web
      await this.page.goto("https://web.whatsapp.com/", {
        waitUntil: "networkidle2",
      });

      // Wait for QR code scan (manual process)
      await this.page.waitForSelector('div[data-testid="chat-list"]', {
        timeout: 60000,
      });

      // Navigate to specific group
      await this.page.goto(`https://web.whatsapp.com/accept?code=${groupId}`, {
        waitUntil: "networkidle2",
      });

      // Wait for messages to load
      await this.page.waitForSelector(messageSelector, { timeout: 30000 });

      // Extract messages
      const messages = await this.page.evaluate((selector) => {
        const messageElements = document.querySelectorAll(selector);
        return Array.from(messageElements).map((element) => {
          const textElement = element.querySelector(".selectable-text");
          const imageElements = element.querySelectorAll("img");

          return {
            text: textElement ? textElement.textContent.trim() : "",
            images: Array.from(imageElements).map((img) => img.src),
            timestamp: new Date().toISOString(),
            senderId: element.getAttribute("data-id") || "",
          };
        });
      }, messageSelector);

      // Persist cookies for next runs
      try {
        const cookies = await this.page.cookies();
        const fs = require("fs");
        fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies, null, 2));
      } catch (e) {
        console.warn("Failed to save WhatsApp cookies");
      }

      return messages;
    } catch (error) {
      console.error("Error parsing WhatsApp messages:", error);
      throw error;
    }
  }

  async parseWatchListing(messageText, images = []) {
    try {
      // Generate hash for duplicate detection
      const hash = crypto.createHash("md5").update(messageText).digest("hex");

      // Check if listing already exists
      const existingListing = await Listing.findOne({ duplicateHash: hash });
      if (existingListing) {
        return { isDuplicate: true, listing: existingListing };
      }

      // Parse watch information using regex patterns
      const parsed = this.extractWatchInfo(messageText);

      // Create new listing
      const listing = new Listing({
        groupId: "default", // Will be set by caller
        messageText,
        parsed,
        duplicateHash: hash,
        sourceType: "scraped",
        isProcessed: true,
        processingStatus: "processed",
        confidence: this.calculateConfidence(parsed),
      });

      await listing.save();

      return { isDuplicate: false, listing };
    } catch (error) {
      console.error("Error parsing watch listing:", error);
      throw error;
    }
  }

  extractWatchInfo(text) {
    const parsed = {
      brand: "",
      model: "",
      price: null,
      currency: "USD",
      images: [],
      sellerName: "",
      sellerPhone: "",
      location: "",
      condition: "",
      year: null,
      refNo: "",
      description: "",
    };

    // Extract brand (common watch brands)
    const brands = [
      "Rolex",
      "Omega",
      "Patek Philippe",
      "Audemars Piguet",
      "Cartier",
      "IWC",
      "Panerai",
      "Hublot",
      "Tag Heuer",
      "Breitling",
    ];
    for (const brand of brands) {
      if (text.toLowerCase().includes(brand.toLowerCase())) {
        parsed.brand = brand;
        break;
      }
    }

    // Extract price
    const priceRegex =
      /(\$|€|£|AED|SAR|QAR|KWD|OMR|BHD)\s*([\d,]+(?:\.\d{2})?)/gi;
    const priceMatch = text.match(priceRegex);
    if (priceMatch) {
      const priceStr = priceMatch[0].replace(/[^\d.]/g, "");
      parsed.price = parseFloat(priceStr);
      parsed.currency = priceMatch[0].match(/[^\d\s,.]/)[0] || "USD";
    }

    // Extract model/reference number
    const refRegex = /(?:ref|reference|model)\s*[#:]\s*([A-Z0-9-]+)/i;
    const refMatch = text.match(refRegex);
    if (refMatch) {
      parsed.refNo = refMatch[1];
    }

    // Extract year
    const yearRegex = /\b(19|20)\d{2}\b/;
    const yearMatch = text.match(yearRegex);
    if (yearMatch) {
      parsed.year = parseInt(yearMatch[0]);
    }

    // Extract condition
    const conditionKeywords = [
      "mint",
      "excellent",
      "very good",
      "good",
      "fair",
      "new",
      "unworn",
    ];
    for (const condition of conditionKeywords) {
      if (text.toLowerCase().includes(condition)) {
        parsed.condition = condition;
        break;
      }
    }

    // Extract location
    const locationKeywords = [
      "UAE",
      "Dubai",
      "Abu Dhabi",
      "Sharjah",
      "KSA",
      "Saudi Arabia",
      "Qatar",
      "Kuwait",
      "Oman",
      "Bahrain",
      "UK",
      "USA",
      "Hong Kong",
      "HK",
    ];
    for (const location of locationKeywords) {
      if (text.toLowerCase().includes(location.toLowerCase())) {
        parsed.location = location;
        break;
      }
    }

    // Extract phone number
    const phoneRegex = /(\+971|971|05\d{8}|06\d{8})/;
    const phoneMatch = text.match(phoneRegex);
    if (phoneMatch) {
      parsed.sellerPhone = phoneMatch[1];
    }

    // Set description
    parsed.description = text;

    // Map common locations to country tags
    const map = {
      UAE: "UAE",
      Dubai: "UAE",
      "Abu Dhabi": "UAE",
      Sharjah: "UAE",
      KSA: "SA",
      "Saudi Arabia": "SA",
      Qatar: "QA",
      Kuwait: "KW",
      Oman: "OM",
      Bahrain: "BH",
      UK: "UK",
      USA: "US",
      "Hong Kong": "HK",
      HK: "HK",
    };
    parsed.countryTag = map[parsed.location] || "";

    return parsed;
  }

  calculateConfidence(parsed) {
    let confidence = 0;

    if (parsed.brand) confidence += 0.3;
    if (parsed.price) confidence += 0.3;
    if (parsed.refNo) confidence += 0.2;
    if (parsed.year) confidence += 0.1;
    if (parsed.condition) confidence += 0.1;

    return Math.min(confidence, 1);
  }

  async close() {
    if (this.browser && puppeteer) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async processGroupListings(groupId, limit = 50) {
    try {
      const messages = await this.parseGroupMessages(groupId);
      const processedListings = [];

      for (const message of messages.slice(-limit)) {
        if (message.text && this.isWatchListing(message.text)) {
          const result = await this.parseWatchListing(
            message.text,
            message.images
          );
          if (!result.isDuplicate) {
            processedListings.push(result.listing);
          }
        }
      }

      return processedListings;
    } catch (error) {
      console.error("Error processing group listings:", error);
      throw error;
    }
  }

  isWatchListing(text) {
    const watchKeywords = [
      "rolex",
      "omega",
      "patek",
      "audemars",
      "cartier",
      "iwc",
      "panerai",
      "hublot",
      "tag",
      "breitling",
      "watch",
      "timepiece",
    ];
    const lowerText = text.toLowerCase();

    return watchKeywords.some((keyword) => lowerText.includes(keyword));
  }
}

module.exports = WhatsAppParser;
