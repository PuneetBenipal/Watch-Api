require("dotenv").config();
const http = require("http");
const { connectDB } = require("./config/db");
const app = require("./app");
// const setupSocket = require('./socket');

const server = http.createServer(app);

// Set up Socket.IO
// const io = setupSocket(server);
// // Make io available to routes if needed
// app.set('io', io);

const PORT = process.env.PORT || 5000;

// Scheduled task to disable expired discount codes
const setupExpiredCodesTask = async () => {
  try {
    const DiscountCode = require("./models/DiscountCode");

    // Run the task every hour
    setInterval(
      async () => {
        try {
          console.log(
            "🕐 Running scheduled task: Disabling expired discount codes..."
          );
          const result = await DiscountCode.disableExpiredCodes();
          if (result.modifiedCount > 0) {
            console.log(
              `✅ Disabled ${result.modifiedCount} expired discount codes`
            );
          } else {
            console.log("✅ No expired discount codes found");
          }
        } catch (error) {
          console.error(
            "❌ Error in scheduled task (disable expired codes):",
            error
          );
        }
      },
      60 * 60 * 1000
    ); // Run every hour (60 minutes * 60 seconds * 1000 milliseconds)

    // Also run once on startup
    console.log("🕐 Running initial check for expired discount codes...");
    const result = await DiscountCode.disableExpiredCodes();
    if (result.modifiedCount > 0) {
      console.log(
        `✅ Disabled ${result.modifiedCount} expired discount codes on startup`
      );
    } else {
      console.log("✅ No expired discount codes found on startup");
    }
  } catch (error) {
    console.error("❌ Error setting up expired codes task:", error);
  }
};

// Scheduled task to update exchange rates daily
const setupExchangeRatesTask = async () => {
  try {
    const ExchangeRate = require("./models/ExchangeRate");

    // Run the task every 24 hours
    setInterval(
      async () => {
        try {
          console.log("🕐 Running scheduled task: Updating exchange rates...");
          const updatedRates = await ExchangeRate.updateFromAPI();
          console.log(
            "✅ Exchange rates updated from API:",
            updatedRates.toFrontendFormat()
          );
        } catch (error) {
          console.error(
            "❌ Error in scheduled task (update exchange rates):",
            error
          );
        }
      },
      24 * 60 * 60 * 1000
    ); // Run every 24 hours

    // Also run once on startup if autoUpdate is enabled
    console.log("🕐 Running initial check for exchange rates...");
    const latestRates = await ExchangeRate.getLatest();
    if (latestRates.autoUpdate) {
      try {
        const updatedRates = await ExchangeRate.updateFromAPI();
        console.log(
          "✅ Exchange rates updated from API on startup:",
          updatedRates.toFrontendFormat()
        );
      } catch (error) {
        console.error("❌ Error updating exchange rates on startup:", error);
      }
    } else {
      console.log("✅ Auto-update disabled, using existing exchange rates");
    }
  } catch (error) {
    console.error("❌ Error setting up exchange rates task:", error);
  }
};

// Connect to MongoDB and start server
connectDB()
  .then(async () => {
    // Set up the scheduled tasks
    await setupExpiredCodesTask();
    await setupExchangeRatesTask();

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
