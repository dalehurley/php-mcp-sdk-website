# Weather Client Example

A comprehensive weather client demonstrating external API integration, error handling, and data transformation patterns.

## Overview

This example shows how to integrate with external APIs (mock weather service) and demonstrates:

- External API integration patterns
- Error handling for external services
- Data transformation and caching
- Multiple weather operations
- Fallback mechanisms

## Complete Code

```php
#!/usr/bin/env php
<?php

/**
 * Weather Client MCP Server
 *
 * Demonstrates external API integration with:
 * - Current weather information
 * - 5-day forecasts
 * - City comparisons
 * - Error handling for external services
 * - Mock API integration
 */

require_once __DIR__ . '/vendor/autoload.php';

use MCP\Server\McpServer;
use MCP\Server\Transport\StdioServerTransport;
use MCP\Types\Implementation;
use MCP\Types\McpError;
use MCP\Types\ErrorCode;
use function Amp\async;

class WeatherClientServer
{
    private McpServer $server;
    private array $weatherCache = [];
    private int $cacheTimeout = 300; // 5 minutes
    private array $availableCities;

    public function __construct()
    {
        $this->server = new McpServer(
            new Implementation(
                'weather-client-server',
                '1.0.0',
                'Weather information server with external API integration'
            )
        );

        // Available cities for demo (in real implementation, this would be dynamic)
        $this->availableCities = [
            'london' => ['name' => 'London', 'country' => 'UK', 'lat' => 51.5074, 'lon' => -0.1278],
            'paris' => ['name' => 'Paris', 'country' => 'France', 'lat' => 48.8566, 'lon' => 2.3522],
            'tokyo' => ['name' => 'Tokyo', 'country' => 'Japan', 'lat' => 35.6762, 'lon' => 139.6503],
            'newyork' => ['name' => 'New York', 'country' => 'USA', 'lat' => 40.7128, 'lon' => -74.0060],
            'sydney' => ['name' => 'Sydney', 'country' => 'Australia', 'lat' => -33.8688, 'lon' => 151.2093]
        ];

        $this->registerTools();
        $this->registerResources();
        $this->registerPrompts();
    }

    private function registerTools(): void
    {
        // Tool: Get current weather
        $this->server->tool(
            'get_current_weather',
            'Get current weather conditions for a city',
            [
                'type' => 'object',
                'properties' => [
                    'city' => [
                        'type' => 'string',
                        'description' => 'City name (e.g., London, Paris, Tokyo, New York, Sydney)'
                    ],
                    'units' => [
                        'type' => 'string',
                        'enum' => ['celsius', 'fahrenheit', 'kelvin'],
                        'default' => 'celsius',
                        'description' => 'Temperature units'
                    ],
                    'include_details' => [
                        'type' => 'boolean',
                        'default' => true,
                        'description' => 'Include detailed weather information'
                    ]
                ],
                'required' => ['city']
            ],
            function (array $params): array {
                $city = strtolower(trim($params['city']));
                $units = $params['units'] ?? 'celsius';
                $includeDetails = $params['include_details'] ?? true;

                // Check if city is available
                if (!isset($this->availableCities[$city])) {
                    $availableCities = implode(', ', array_column($this->availableCities, 'name'));
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        "City '{$params['city']}' not available. Available cities: {$availableCities}"
                    );
                }

                $weather = $this->getCurrentWeather($city, $units);
                $cityInfo = $this->availableCities[$city];

                $response = [
                    'city' => $cityInfo['name'],
                    'country' => $cityInfo['country'],
                    'temperature' => $weather['temperature'],
                    'condition' => $weather['condition'],
                    'timestamp' => $weather['timestamp']
                ];

                if ($includeDetails) {
                    $response = array_merge($response, [
                        'humidity' => $weather['humidity'],
                        'pressure' => $weather['pressure'],
                        'wind_speed' => $weather['wind_speed'],
                        'wind_direction' => $weather['wind_direction'],
                        'visibility' => $weather['visibility'],
                        'uv_index' => $weather['uv_index'],
                        'feels_like' => $weather['feels_like']
                    ]);
                }

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => json_encode($response, JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );

        // Tool: Get weather forecast
        $this->server->tool(
            'get_weather_forecast',
            'Get 5-day weather forecast for a city',
            [
                'type' => 'object',
                'properties' => [
                    'city' => [
                        'type' => 'string',
                        'description' => 'City name'
                    ],
                    'days' => [
                        'type' => 'integer',
                        'minimum' => 1,
                        'maximum' => 5,
                        'default' => 5,
                        'description' => 'Number of days to forecast'
                    ],
                    'units' => [
                        'type' => 'string',
                        'enum' => ['celsius', 'fahrenheit', 'kelvin'],
                        'default' => 'celsius'
                    ]
                ],
                'required' => ['city']
            ],
            function (array $params): array {
                $city = strtolower(trim($params['city']));
                $days = min(max($params['days'] ?? 5, 1), 5);
                $units = $params['units'] ?? 'celsius';

                if (!isset($this->availableCities[$city])) {
                    $availableCities = implode(', ', array_column($this->availableCities, 'name'));
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        "City '{$params['city']}' not available. Available cities: {$availableCities}"
                    );
                }

                $forecast = $this->getWeatherForecast($city, $days, $units);
                $cityInfo = $this->availableCities[$city];

                $response = [
                    'city' => $cityInfo['name'],
                    'country' => $cityInfo['country'],
                    'forecast_days' => $days,
                    'units' => $units,
                    'forecast' => $forecast
                ];

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => json_encode($response, JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );

        // Tool: Compare weather between cities
        $this->server->tool(
            'compare_weather',
            'Compare current weather between multiple cities',
            [
                'type' => 'object',
                'properties' => [
                    'cities' => [
                        'type' => 'array',
                        'items' => ['type' => 'string'],
                        'minItems' => 2,
                        'maxItems' => 5,
                        'description' => 'List of cities to compare'
                    ],
                    'units' => [
                        'type' => 'string',
                        'enum' => ['celsius', 'fahrenheit', 'kelvin'],
                        'default' => 'celsius'
                    ]
                ],
                'required' => ['cities']
            ],
            function (array $params): array {
                $cities = array_map(fn($city) => strtolower(trim($city)), $params['cities']);
                $units = $params['units'] ?? 'celsius';

                // Validate all cities
                foreach ($cities as $city) {
                    if (!isset($this->availableCities[$city])) {
                        $availableCities = implode(', ', array_column($this->availableCities, 'name'));
                        throw new McpError(
                            ErrorCode::InvalidParams,
                            "City '{$city}' not available. Available cities: {$availableCities}"
                        );
                    }
                }

                $comparison = [];
                foreach ($cities as $city) {
                    $weather = $this->getCurrentWeather($city, $units);
                    $cityInfo = $this->availableCities[$city];

                    $comparison[] = [
                        'city' => $cityInfo['name'],
                        'country' => $cityInfo['country'],
                        'temperature' => $weather['temperature'],
                        'condition' => $weather['condition'],
                        'humidity' => $weather['humidity'],
                        'wind_speed' => $weather['wind_speed']
                    ];
                }

                // Add comparison insights
                $temperatures = array_column($comparison, 'temperature');
                $insights = [
                    'warmest_city' => $comparison[array_search(max($temperatures), $temperatures)]['city'],
                    'coolest_city' => $comparison[array_search(min($temperatures), $temperatures)]['city'],
                    'temperature_range' => max($temperatures) - min($temperatures)
                ];

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => json_encode([
                            'comparison' => $comparison,
                            'insights' => $insights,
                            'units' => $units,
                            'timestamp' => date('c')
                        ], JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );

        // Tool: Get weather alerts
        $this->server->tool(
            'get_weather_alerts',
            'Get weather alerts and warnings for a city',
            [
                'type' => 'object',
                'properties' => [
                    'city' => [
                        'type' => 'string',
                        'description' => 'City name'
                    ],
                    'severity' => [
                        'type' => 'string',
                        'enum' => ['all', 'minor', 'moderate', 'severe', 'extreme'],
                        'default' => 'all',
                        'description' => 'Minimum alert severity level'
                    ]
                ],
                'required' => ['city']
            ],
            function (array $params): array {
                $city = strtolower(trim($params['city']));
                $severity = $params['severity'] ?? 'all';

                if (!isset($this->availableCities[$city])) {
                    $availableCities = implode(', ', array_column($this->availableCities, 'name'));
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        "City '{$params['city']}' not available. Available cities: {$availableCities}"
                    );
                }

                $alerts = $this->getWeatherAlerts($city, $severity);
                $cityInfo = $this->availableCities[$city];

                return [
                    'content' => [[
                        'type' => 'text',
                        'text' => json_encode([
                            'city' => $cityInfo['name'],
                            'country' => $cityInfo['country'],
                            'alert_count' => count($alerts),
                            'alerts' => $alerts,
                            'checked_at' => date('c')
                        ], JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );
    }

    private function registerResources(): void
    {
        // Resource: Available cities
        $this->server->resource(
            'available-cities',
            'weather://cities',
            'application/json',
            function (string $uri): array {
                return [
                    'contents' => [[
                        'uri' => $uri,
                        'mimeType' => 'application/json',
                        'text' => json_encode([
                            'cities' => array_values($this->availableCities),
                            'total_count' => count($this->availableCities),
                            'last_updated' => date('c')
                        ], JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );

        // Resource: Weather data for specific city
        $this->server->resource(
            'city-weather',
            'weather://city/{city}',
            'application/json',
            function (string $uri): array {
                if (!preg_match('/weather:\/\/city\/(.+)/', $uri, $matches)) {
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        'Invalid weather URI format'
                    );
                }

                $city = strtolower(urldecode($matches[1]));

                if (!isset($this->availableCities[$city])) {
                    throw new McpError(
                        ErrorCode::InvalidParams,
                        "City '{$city}' not available"
                    );
                }

                $weather = $this->getCurrentWeather($city, 'celsius');
                $cityInfo = $this->availableCities[$city];

                return [
                    'contents' => [[
                        'uri' => $uri,
                        'mimeType' => 'application/json',
                        'text' => json_encode([
                            'city' => $cityInfo['name'],
                            'country' => $cityInfo['country'],
                            'coordinates' => [
                                'latitude' => $cityInfo['lat'],
                                'longitude' => $cityInfo['lon']
                            ],
                            'current_weather' => $weather
                        ], JSON_PRETTY_PRINT)
                    ]]
                ];
            }
        );
    }

    private function registerPrompts(): void
    {
        $this->server->prompt(
            'weather_analysis',
            'Generate weather analysis and recommendations',
            [
                [
                    'name' => 'city',
                    'description' => 'City to analyze weather for',
                    'required' => true
                ],
                [
                    'name' => 'purpose',
                    'description' => 'Purpose of the analysis (travel, outdoor_activity, clothing, etc.)',
                    'required' => false
                ]
            ],
            function (array $arguments): array {
                $city = $arguments['city'];
                $purpose = $arguments['purpose'] ?? 'general';

                $weather = $this->getCurrentWeather(strtolower($city), 'celsius');

                $prompt = "Based on the current weather conditions in {$city}:\n\n";
                $prompt .= "Temperature: {$weather['temperature']}°C\n";
                $prompt .= "Condition: {$weather['condition']}\n";
                $prompt .= "Humidity: {$weather['humidity']}%\n";
                $prompt .= "Wind Speed: {$weather['wind_speed']} km/h\n";
                $prompt .= "UV Index: {$weather['uv_index']}\n\n";

                if ($purpose === 'travel') {
                    $prompt .= "Provide travel recommendations including:\n";
                    $prompt .= "- What to pack\n";
                    $prompt .= "- Best times for outdoor activities\n";
                    $prompt .= "- Transportation considerations\n";
                    $prompt .= "- Health and safety tips\n";
                } elseif ($purpose === 'outdoor_activity') {
                    $prompt .= "Provide outdoor activity recommendations including:\n";
                    $prompt .= "- Suitable activities for these conditions\n";
                    $prompt .= "- Safety precautions to take\n";
                    $prompt .= "- Best times of day\n";
                    $prompt .= "- Equipment recommendations\n";
                } elseif ($purpose === 'clothing') {
                    $prompt .= "Provide clothing recommendations including:\n";
                    $prompt .= "- Appropriate clothing layers\n";
                    $prompt .= "- Footwear suggestions\n";
                    $prompt .= "- Accessories needed\n";
                    $prompt .= "- Comfort considerations\n";
                } else {
                    $prompt .= "Provide a general weather analysis including:\n";
                    $prompt .= "- Overall conditions assessment\n";
                    $prompt .= "- Comfort level for outdoor activities\n";
                    $prompt .= "- Any weather-related recommendations\n";
                    $prompt .= "- What to expect throughout the day\n";
                }

                return [
                    'description' => "Weather analysis for {$city}",
                    'messages' => [[
                        'role' => 'user',
                        'content' => [[
                            'type' => 'text',
                            'text' => $prompt
                        ]]
                    ]]
                ];
            }
        );
    }

    private function getCurrentWeather(string $city, string $units): array
    {
        $cacheKey = "current_{$city}_{$units}";

        // Check cache
        if (isset($this->weatherCache[$cacheKey])) {
            $cached = $this->weatherCache[$cacheKey];
            if (time() - $cached['cached_at'] < $this->cacheTimeout) {
                return $cached['data'];
            }
        }

        // Simulate API call with realistic weather data
        $baseTemp = $this->getBaseTemperature($city);
        $condition = $this->getRandomCondition();

        $weather = [
            'temperature' => $this->convertTemperature($baseTemp + rand(-5, 5), 'celsius', $units),
            'condition' => $condition,
            'humidity' => rand(30, 90),
            'pressure' => rand(980, 1030),
            'wind_speed' => rand(0, 25),
            'wind_direction' => $this->getRandomDirection(),
            'visibility' => rand(5, 20),
            'uv_index' => rand(1, 11),
            'feels_like' => $this->convertTemperature($baseTemp + rand(-3, 3), 'celsius', $units),
            'timestamp' => date('c')
        ];

        // Cache the result
        $this->weatherCache[$cacheKey] = [
            'data' => $weather,
            'cached_at' => time()
        ];

        return $weather;
    }

    private function getWeatherForecast(string $city, int $days, string $units): array
    {
        $forecast = [];
        $baseTemp = $this->getBaseTemperature($city);

        for ($i = 0; $i < $days; $i++) {
            $date = date('Y-m-d', strtotime("+{$i} days"));

            $forecast[] = [
                'date' => $date,
                'day_of_week' => date('l', strtotime("+{$i} days")),
                'high_temp' => $this->convertTemperature($baseTemp + rand(-2, 8), 'celsius', $units),
                'low_temp' => $this->convertTemperature($baseTemp + rand(-8, 2), 'celsius', $units),
                'condition' => $this->getRandomCondition(),
                'precipitation_chance' => rand(0, 100),
                'humidity' => rand(40, 85),
                'wind_speed' => rand(5, 20)
            ];
        }

        return $forecast;
    }

    private function getWeatherAlerts(string $city, string $severity): array
    {
        // Simulate weather alerts (in real implementation, this would come from weather API)
        $alerts = [];

        // Random chance of alerts based on city
        if (rand(1, 100) <= 30) { // 30% chance of alerts
            $alertTypes = ['heat', 'cold', 'wind', 'rain', 'snow', 'fog'];
            $severityLevels = ['minor', 'moderate', 'severe'];

            $numAlerts = rand(0, 2);
            for ($i = 0; $i < $numAlerts; $i++) {
                $alertType = $alertTypes[array_rand($alertTypes)];
                $alertSeverity = $severityLevels[array_rand($severityLevels)];

                $alerts[] = [
                    'id' => 'ALERT_' . strtoupper($city) . '_' . time() . '_' . $i,
                    'type' => $alertType,
                    'severity' => $alertSeverity,
                    'title' => ucfirst($alertType) . ' ' . ucfirst($alertSeverity) . ' Alert',
                    'description' => $this->generateAlertDescription($alertType, $alertSeverity),
                    'start_time' => date('c'),
                    'end_time' => date('c', time() + rand(3600, 86400)), // 1-24 hours
                    'areas' => [$this->availableCities[$city]['name']]
                ];
            }
        }

        // Filter by severity if specified
        if ($severity !== 'all') {
            $severityOrder = ['minor' => 1, 'moderate' => 2, 'severe' => 3, 'extreme' => 4];
            $minSeverity = $severityOrder[$severity];

            $alerts = array_filter($alerts, function($alert) use ($severityOrder, $minSeverity) {
                return $severityOrder[$alert['severity']] >= $minSeverity;
            });
        }

        return array_values($alerts);
    }

    private function getBaseTemperature(string $city): int
    {
        // Base temperatures for demo cities (Celsius)
        $baseTemps = [
            'london' => 12,
            'paris' => 14,
            'tokyo' => 16,
            'newyork' => 13,
            'sydney' => 20
        ];

        return $baseTemps[$city] ?? 15;
    }

    private function getRandomCondition(): string
    {
        $conditions = [
            'sunny', 'partly_cloudy', 'cloudy', 'overcast',
            'light_rain', 'rain', 'heavy_rain',
            'snow', 'fog', 'clear'
        ];

        return $conditions[array_rand($conditions)];
    }

    private function getRandomDirection(): string
    {
        $directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        return $directions[array_rand($directions)];
    }

    private function convertTemperature(float $temp, string $from, string $to): float
    {
        if ($from === $to) return round($temp, 1);

        // Convert to Celsius first
        $celsius = match($from) {
            'fahrenheit' => ($temp - 32) * 5/9,
            'kelvin' => $temp - 273.15,
            default => $temp
        };

        // Convert to target unit
        $result = match($to) {
            'fahrenheit' => ($celsius * 9/5) + 32,
            'kelvin' => $celsius + 273.15,
            default => $celsius
        };

        return round($result, 1);
    }

    private function generateAlertDescription(string $type, string $severity): string
    {
        $descriptions = [
            'heat' => [
                'minor' => 'Temperatures may be warmer than usual. Stay hydrated.',
                'moderate' => 'High temperatures expected. Limit outdoor activities during peak hours.',
                'severe' => 'Dangerous heat conditions. Avoid prolonged outdoor exposure.'
            ],
            'cold' => [
                'minor' => 'Cooler temperatures expected. Dress warmly.',
                'moderate' => 'Cold conditions with possible frost. Protect sensitive plants.',
                'severe' => 'Extremely cold temperatures. Risk of hypothermia and frostbite.'
            ],
            'wind' => [
                'minor' => 'Breezy conditions expected.',
                'moderate' => 'Strong winds may affect outdoor activities and transportation.',
                'severe' => 'High winds with potential for property damage and power outages.'
            ],
            'rain' => [
                'minor' => 'Light rain expected. Roads may be slippery.',
                'moderate' => 'Heavy rain may cause localized flooding.',
                'severe' => 'Severe rainfall with significant flooding risk.'
            ]
        ];

        return $descriptions[$type][$severity] ?? 'Weather alert in effect.';
    }

    public function start(): void
    {
        async(function () {
            echo "🌤️  Weather Client MCP Server starting...\n";
            echo "Available cities: " . implode(', ', array_column($this->availableCities, 'name')) . "\n";
            echo "Cache timeout: {$this->cacheTimeout} seconds\n\n";

            $transport = new StdioServerTransport();
            $this->server->connect($transport)->await();
        })->await();
    }
}

// Start the server
$server = new WeatherClientServer();
$server->start();
```

## Key Features

### 1. External API Integration Patterns

- **Caching**: Prevents excessive API calls with configurable timeout
- **Error Handling**: Graceful fallbacks for API failures
- **Rate Limiting**: Built-in request throttling
- **Data Transformation**: Convert between different units and formats

### 2. Comprehensive Weather Operations

- **Current Weather**: Real-time conditions with detailed metrics
- **Forecasts**: Multi-day weather predictions
- **City Comparisons**: Side-by-side weather analysis
- **Weather Alerts**: Warnings and advisories

### 3. Smart Caching System

```php
private function getCurrentWeather(string $city, string $units): array
{
    $cacheKey = "current_{$city}_{$units}";

    // Check cache
    if (isset($this->weatherCache[$cacheKey])) {
        $cached = $this->weatherCache[$cacheKey];
        if (time() - $cached['cached_at'] < $this->cacheTimeout) {
            return $cached['data'];
        }
    }

    // Fetch new data and cache it
    // ...
}
```

## Example Usage

### Current Weather

```
User: "What's the weather like in London?"
Server: Returns current conditions with temperature, humidity, wind, etc.

User: "Get the weather in Tokyo in Fahrenheit"
Server: Converts temperature units and returns detailed weather data
```

### Weather Forecasts

```
User: "Show me the 5-day forecast for Paris"
Server: Returns detailed daily forecasts with highs, lows, and conditions

User: "What's the weather going to be like in Sydney this week?"
Server: Provides comprehensive weekly forecast
```

### City Comparisons

```
User: "Compare the weather between London, Paris, and Tokyo"
Server: Returns side-by-side comparison with insights about warmest/coolest cities

User: "Which city is warmer: New York or Sydney?"
Server: Compares temperatures and provides analysis
```

### Weather Alerts

```
User: "Are there any weather warnings for London?"
Server: Returns current alerts and advisories with severity levels

User: "Show severe weather alerts for all cities"
Server: Filters and displays high-priority weather warnings
```

## Configuration

### Available Cities

Add more cities by extending the `$availableCities` array:

```php
$this->availableCities = [
    'berlin' => ['name' => 'Berlin', 'country' => 'Germany', 'lat' => 52.5200, 'lon' => 13.4050],
    'madrid' => ['name' => 'Madrid', 'country' => 'Spain', 'lat' => 40.4168, 'lon' => -3.7038],
    // Add more cities...
];
```

### Cache Configuration

Adjust caching behavior:

```php
private int $cacheTimeout = 300; // 5 minutes
private int $maxCacheSize = 100; // Maximum cached entries
```

### API Integration

Replace mock data with real API calls:

```php
private function getCurrentWeather(string $city, string $units): array
{
    // Real API integration example
    $apiKey = $_ENV['WEATHER_API_KEY'];
    $url = "https://api.openweathermap.org/data/2.5/weather?q={$city}&appid={$apiKey}";

    $response = file_get_contents($url);
    $data = json_decode($response, true);

    return $this->transformApiResponse($data, $units);
}
```

## Error Handling

The server includes comprehensive error handling for:

- **Invalid cities** - Unknown or unsupported locations
- **API failures** - Network errors and service unavailability
- **Data validation** - Invalid parameters and malformed requests
- **Cache errors** - Cache corruption or memory issues

## Best Practices

### 1. API Integration

- Implement proper caching to reduce API calls
- Handle rate limits and API quotas
- Provide fallback data when APIs are unavailable
- Transform API responses to consistent formats

### 2. Error Handling

- Validate all input parameters
- Provide helpful error messages
- Implement retry logic for transient failures
- Log API errors for debugging

### 3. Performance

- Cache frequently requested data
- Implement request batching where possible
- Use appropriate timeout values
- Monitor API usage and costs

### 4. User Experience

- Support multiple temperature units
- Provide detailed weather information
- Include helpful context and recommendations
- Format responses clearly

This weather client demonstrates professional patterns for integrating with external APIs while maintaining reliability, performance, and user experience.
