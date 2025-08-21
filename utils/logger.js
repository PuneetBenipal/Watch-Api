const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, data = null) {
    const timestamp = this.getTimestamp();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };
    return JSON.stringify(logEntry);
  }

  writeToFile(filename, content) {
    const filepath = path.join(this.logDir, filename);
    fs.appendFileSync(filepath, content + '\n');
  }

  info(message, data = null) {
    const logEntry = this.formatMessage('INFO', message, data);
    console.log(`[INFO] ${message}`);
    this.writeToFile('app.log', logEntry);
  }

  error(message, error = null) {
    const logEntry = this.formatMessage('ERROR', message, {
      error: error?.message || error,
      stack: error?.stack
    });
    console.error(`[ERROR] ${message}`, error);
    this.writeToFile('error.log', logEntry);
  }

  warn(message, data = null) {
    const logEntry = this.formatMessage('WARN', message, data);
    console.warn(`[WARN] ${message}`);
    this.writeToFile('app.log', logEntry);
  }

  debug(message, data = null) {
    if (process.env.NODE_ENV === 'development') {
      const logEntry = this.formatMessage('DEBUG', message, data);
      console.debug(`[DEBUG] ${message}`);
      this.writeToFile('debug.log', logEntry);
    }
  }

  // Specialized logging methods
  logAuth(userId, action, success = true) {
    this.info(`Auth: ${action}`, {
      userId,
      action,
      success,
      ip: 'N/A' // Could be enhanced with request IP
    });
  }

  logInventory(companyId, action, itemId = null) {
    this.info(`Inventory: ${action}`, {
      companyId,
      action,
      itemId
    });
  }

  logPayment(userId, amount, currency, status) {
    this.info(`Payment: ${status}`, {
      userId,
      amount,
      currency,
      status
    });
  }

  logWhatsApp(groupId, action, messageCount = 0) {
    this.info(`WhatsApp: ${action}`, {
      groupId,
      action,
      messageCount
    });
  }

  logAlert(userId, alertId, triggered = false) {
    this.info(`Alert: ${triggered ? 'triggered' : 'created'}`, {
      userId,
      alertId,
      triggered
    });
  }

  // Performance logging
  logPerformance(operation, duration, metadata = {}) {
    this.info(`Performance: ${operation}`, {
      operation,
      duration,
      ...metadata
    });
  }

  // API request logging
  logRequest(method, path, statusCode, duration, userId = null) {
    this.info(`Request: ${method} ${path}`, {
      method,
      path,
      statusCode,
      duration,
      userId
    });
  }

  // Error tracking
  logError(error, context = {}) {
    this.error('Application Error', {
      message: error.message,
      stack: error.stack,
      ...context
    });
  }

  // Clean up old logs (run periodically)
  cleanupOldLogs(daysToKeep = 30) {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      files.forEach(file => {
        const filepath = path.join(this.logDir, file);
        const stats = fs.statSync(filepath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filepath);
          this.info(`Cleaned up old log file: ${file}`);
        }
      });
    } catch (error) {
      this.error('Log cleanup failed', error);
    }
  }

  // Get log statistics
  getLogStats() {
    try {
      const files = fs.readdirSync(this.logDir);
      const stats = {};

      files.forEach(file => {
        const filepath = path.join(this.logDir, file);
        const content = fs.readFileSync(filepath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        stats[file] = {
          lines: lines.length,
          size: fs.statSync(filepath).size
        };
      });

      return stats;
    } catch (error) {
      this.error('Failed to get log stats', error);
      return {};
    }
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger; 