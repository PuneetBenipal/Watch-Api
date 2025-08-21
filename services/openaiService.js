const axios = require('axios');

class OpenAIService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseURL = 'https://api.openai.com/v1';
  }

  async analyzePricing(watchData) {
    try {
      const prompt = `Analyze the pricing for this watch and provide market insights:
Brand: ${watchData.brand}
Model: ${watchData.model}
Reference: ${watchData.refNo}
Year: ${watchData.year}
Condition: ${watchData.condition}
Listed Price: ${watchData.priceListed} ${watchData.currency}
Country: ${watchData.country}

Please provide:
1. Market value estimate
2. Price competitiveness (overpriced/fair/underpriced)
3. Market trends for this model
4. Recommendations for pricing strategy
5. Confidence level in the analysis (0-100%)`;

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a luxury watch market analyst with expertise in Rolex, Omega, Patek Philippe, and other premium brands. Provide accurate, data-driven pricing analysis.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 500,
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        analysis: response.data.choices[0].message.content,
        model: response.data.model,
        usage: response.data.usage
      };
    } catch (error) {
      console.error('OpenAI pricing analysis error:', error);
      throw new Error('Failed to analyze pricing');
    }
  }

  async generateAlertContent(alertData, matchingListings) {
    try {
      const prompt = `Generate an alert notification for watch listings that match the user's criteria:

Alert Criteria:
- Brand: ${alertData.filters.brand || 'Any'}
- Max Price: ${alertData.filters.maxPrice || 'Any'}
- Country: ${alertData.filters.country || 'Any'}
- Condition: ${alertData.filters.condition || 'Any'}

Matching Listings (${matchingListings.length} found):
${matchingListings.map(listing => 
  `- ${listing.parsed.brand} ${listing.parsed.model} (${listing.parsed.refNo}) - ${listing.parsed.currency} ${listing.parsed.price}`
).join('\n')}

Please create a concise, professional alert message that includes:
1. Summary of new matches
2. Key highlights (best deals, rare pieces)
3. Call to action
4. Professional tone suitable for watch dealers`;

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a professional watch trading assistant. Create concise, informative alerts for watch dealers.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 300,
          temperature: 0.4
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        content: response.data.choices[0].message.content,
        model: response.data.model,
        usage: response.data.usage
      };
    } catch (error) {
      console.error('OpenAI alert generation error:', error);
      throw new Error('Failed to generate alert content');
    }
  }

  async extractWatchInfo(messageText) {
    try {
      const prompt = `Extract structured watch information from this message:

Message: "${messageText}"

Please extract and return ONLY a JSON object with the following fields:
{
  "brand": "watch brand",
  "model": "specific model",
  "refNo": "reference number",
  "price": number,
  "currency": "currency code",
  "year": number,
  "condition": "condition description",
  "location": "location",
  "sellerPhone": "phone number",
  "confidence": number (0-100)
}

If any field cannot be determined, use null. Be precise and accurate.`;

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a watch information extraction specialist. Extract precise watch details from messages.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 200,
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      console.error('OpenAI watch info extraction error:', error);
      throw new Error('Failed to extract watch information');
    }
  }

  async generateMarketReport(companyId, timeRange = '30d') {
    try {
      const prompt = `Generate a comprehensive watch market report for the Middle East region covering:

1. Market Trends (last ${timeRange})
2. Price Movements for Popular Models
3. Regional Demand Patterns
4. Seasonal Factors
5. Investment Opportunities
6. Risk Factors

Focus on:
- Rolex, Omega, Patek Philippe, Audemars Piguet
- UAE, Saudi Arabia, Qatar, Kuwait markets
- Price ranges $5,000 - $500,000
- Professional tone for watch dealers`;

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a luxury watch market analyst specializing in Middle Eastern markets. Provide comprehensive, data-driven market reports.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        report: response.data.choices[0].message.content,
        model: response.data.model,
        usage: response.data.usage,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('OpenAI market report error:', error);
      throw new Error('Failed to generate market report');
    }
  }

  async validateWatchAuthenticity(watchData) {
    try {
      const prompt = `Analyze this watch listing for authenticity indicators:

Brand: ${watchData.brand}
Model: ${watchData.model}
Reference: ${watchData.refNo}
Year: ${watchData.year}
Price: ${watchData.price}
Description: ${watchData.description}

Provide a JSON response with:
{
  "authenticityScore": number (0-100),
  "redFlags": ["list of concerns"],
  "greenFlags": ["positive indicators"],
  "recommendation": "buy/avoid/investigate",
  "confidence": number (0-100)
}`;

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a luxury watch authentication expert. Analyze listings for authenticity indicators and red flags.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 300,
          temperature: 0.2
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      console.error('OpenAI authenticity validation error:', error);
      throw new Error('Failed to validate watch authenticity');
    }
  }
}

module.exports = OpenAIService; 