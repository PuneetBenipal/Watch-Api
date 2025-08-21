// Try to import Joi, but make it optional
let Joi;
try {
  Joi = require('joi');
} catch (error) {
  console.warn('Joi not installed. Validation will be disabled.');
  Joi = null;
}

class Validator {
  // User validation schemas
  static userRegistration = Joi ? Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    name: Joi.string().min(2).max(100).required(),
    companyName: Joi.string().min(2).max(100).optional()
  }) : null;

  static userLogin = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });

  static userProfileUpdate = Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    defaultCurrency: Joi.string().valid('USD', 'EUR', 'AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD').optional(),
    region: Joi.string().valid('UAE', 'KSA', 'Qatar', 'Kuwait', 'Oman', 'Bahrain').optional()
  });

  static passwordChange = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required()
  });

  // Inventory validation schemas
  static inventoryCreate = Joi.object({
    brand: Joi.string().min(1).max(100).required(),
    model: Joi.string().min(1).max(100).required(),
    refNo: Joi.string().min(1).max(50).required(),
    year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).required(),
    condition: Joi.string().min(1).max(50).required(),
    pricePaid: Joi.number().positive().required(),
    priceListed: Joi.number().positive().required(),
    currency: Joi.string().valid('USD', 'EUR', 'AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD').optional(),
    country: Joi.string().min(1).max(100).required(),
    visibility: Joi.string().valid('private', 'shared', 'public').optional(),
    description: Joi.string().max(1000).optional(),
    features: Joi.array().items(Joi.string()).optional(),
    serialNumber: Joi.string().max(100).optional(),
    boxPapers: Joi.string().valid('Full Set', 'Box Only', 'Papers Only', 'None').optional(),
    movement: Joi.string().max(100).optional(),
    caseSize: Joi.string().max(50).optional(),
    caseMaterial: Joi.string().max(100).optional(),
    braceletMaterial: Joi.string().max(100).optional(),
    dialColor: Joi.string().max(50).optional(),
    waterResistance: Joi.string().max(50).optional(),
    images: Joi.array().items(Joi.string().uri()).optional()
  });

  static inventoryUpdate = Joi.object({
    brand: Joi.string().min(1).max(100).optional(),
    model: Joi.string().min(1).max(100).optional(),
    refNo: Joi.string().min(1).max(50).optional(),
    year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
    condition: Joi.string().min(1).max(50).optional(),
    pricePaid: Joi.number().positive().optional(),
    priceListed: Joi.number().positive().optional(),
    currency: Joi.string().valid('USD', 'EUR', 'AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD').optional(),
    country: Joi.string().min(1).max(100).optional(),
    visibility: Joi.string().valid('private', 'shared', 'public').optional(),
    status: Joi.string().valid('Available', 'On Hold', 'Sold').optional(),
    description: Joi.string().max(1000).optional(),
    features: Joi.array().items(Joi.string()).optional(),
    serialNumber: Joi.string().max(100).optional(),
    boxPapers: Joi.string().valid('Full Set', 'Box Only', 'Papers Only', 'None').optional(),
    movement: Joi.string().max(100).optional(),
    caseSize: Joi.string().max(50).optional(),
    caseMaterial: Joi.string().max(100).optional(),
    braceletMaterial: Joi.string().max(100).optional(),
    dialColor: Joi.string().max(50).optional(),
    waterResistance: Joi.string().max(50).optional(),
    images: Joi.array().items(Joi.string().uri()).optional()
  });

  // Invoice validation schemas
  static invoiceCreate = Joi.object({
    buyer: Joi.object({
      name: Joi.string().min(1).max(100).required(),
      phone: Joi.string().max(20).optional(),
      email: Joi.string().email().optional(),
      address: Joi.object({
        street: Joi.string().max(200).optional(),
        city: Joi.string().max(100).optional(),
        state: Joi.string().max(100).optional(),
        country: Joi.string().max(100).optional(),
        zipCode: Joi.string().max(20).optional()
      }).optional()
    }).required(),
    items: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
    subtotal: Joi.number().positive().required(),
    tax: Joi.number().min(0).optional(),
    discount: Joi.number().min(0).optional(),
    total: Joi.number().positive().required(),
    currency: Joi.string().valid('USD', 'EUR', 'AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD').optional(),
    paymentMethod: Joi.string().valid('Wire', 'Cash', 'Crypto', 'Escrow', 'Credit Card').required(),
    dueDate: Joi.date().min('now').required(),
    notes: Joi.string().max(1000).optional()
  });

  // Alert validation schemas
  static alertCreate = Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500).optional(),
    filters: Joi.object({
      brand: Joi.string().max(100).optional(),
      model: Joi.string().max(100).optional(),
      minPrice: Joi.number().min(0).optional(),
      maxPrice: Joi.number().min(0).optional(),
      country: Joi.string().max(100).optional(),
      condition: Joi.string().max(50).optional(),
      year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
      minYear: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
      maxYear: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional()
    }).required(),
    channel: Joi.string().valid('email', 'telegram', 'in-app').optional(),
    notificationSettings: Joi.object({
      email: Joi.boolean().optional(),
      telegram: Joi.boolean().optional(),
      inApp: Joi.boolean().optional()
    }).optional()
  });

  // Company validation schemas
  static companyCreate = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    logoUrl: Joi.string().uri().optional(),
    plan: Joi.string().valid('Basic', 'Pro', 'Premium').optional(),
    modulesEnabled: Joi.array().items(Joi.string().valid('inventory', 'alerts', 'invoicing')).optional()
  });

  // Listing validation schemas
  static listingCreate = Joi.object({
    groupId: Joi.string().required(),
    messageText: Joi.string().required(),
    parsed: Joi.object({
      brand: Joi.string().max(100).optional(),
      model: Joi.string().max(100).optional(),
      price: Joi.number().positive().optional(),
      currency: Joi.string().max(10).optional(),
      images: Joi.array().items(Joi.string().uri()).optional(),
      sellerName: Joi.string().max(100).optional(),
      sellerPhone: Joi.string().max(20).optional(),
      location: Joi.string().max(100).optional(),
      condition: Joi.string().max(50).optional(),
      year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
      refNo: Joi.string().max(50).optional(),
      description: Joi.string().max(1000).optional()
    }).optional(),
    sourceType: Joi.string().valid('scraped', 'manual', 'api').optional(),
    countryTag: Joi.string().max(50).optional()
  });

  // Pagination validation
  static pagination = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional()
  });

  // Search validation
  static search = Joi.object({
    q: Joi.string().min(1).max(200).required(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional()
  });

  // Validation methods
  static validate(schema, data) {
    if (!Joi || !schema) {
      // If Joi is not available, return the data as-is
      return data;
    }

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      throw new Error(JSON.stringify(errors));
    }

    return value;
  }

  // Custom validation methods
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone);
  }

  static validateCurrency(currency) {
    const validCurrencies = ['USD', 'EUR', 'AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD'];
    return validCurrencies.includes(currency);
  }

  static validateObjectId(id) {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    return objectIdRegex.test(id);
  }

  static validatePrice(price) {
    return typeof price === 'number' && price > 0 && price <= 10000000; // Max 10M
  }

  static validateYear(year) {
    const currentYear = new Date().getFullYear();
    return typeof year === 'number' && year >= 1900 && year <= currentYear + 1;
  }

  // Sanitization methods
  static sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return str.trim().replace(/[<>]/g, '');
  }

  static sanitizeEmail(email) {
    if (typeof email !== 'string') return email;
    return email.toLowerCase().trim();
  }

  static sanitizePhone(phone) {
    if (typeof phone !== 'string') return phone;
    return phone.replace(/[^\d+]/g, '');
  }

  static sanitizePrice(price) {
    if (typeof price === 'string') {
      price = parseFloat(price.replace(/[^\d.]/g, ''));
    }
    return typeof price === 'number' ? Math.round(price * 100) / 100 : price;
  }

  // Validation error formatter
  static formatValidationError(error) {
    try {
      const errors = JSON.parse(error.message);
      return {
        success: false,
        message: 'Validation failed',
        errors
      };
    } catch {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = Validator; 