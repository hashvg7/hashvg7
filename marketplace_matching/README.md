# Marketplace Data Matching System

A comprehensive system for matching categories, attributes, and list of values (LOV) across different e-commerce marketplaces.

## Overview

This system helps identify and map equivalent data structures between different marketplace platforms. It uses string similarity algorithms to match:

- **Categories**: Product categories and their hierarchies
- **Attributes**: Product attributes/specifications (e.g., Brand, Color, Size)
- **List of Values (LOV)**: Enumerated values for attributes (e.g., "Red", "Blue", "Green")

## Features

- Configurable similarity threshold for matching accuracy
- Normalized string comparison to handle variations
- Hierarchical matching (categories → attributes → LOVs)
- Detailed matching reports in both JSON and text formats
- Support for multiple marketplace data structures

## Directory Structure

```
marketplace_matching/
├── data/                           # Marketplace data files
│   ├── amazon_marketplace.json     # Amazon marketplace structure
│   └── flipkart_marketplace.json   # Flipkart marketplace structure
├── scripts/                        # Matching scripts
│   └── marketplace_matcher.py      # Main matching algorithm
├── output/                         # Generated results
│   ├── marketplace_matches.json    # Detailed matching results
│   └── matching_report.txt         # Human-readable report
└── README.md                       # This file
```

## Data Format

### Marketplace JSON Structure

```json
{
  "marketplace_name": "Amazon",
  "marketplace_id": "amazon_us",
  "categories": [
    {
      "category_id": "unique_category_id",
      "category_name": "Category Name",
      "category_path": "Parent > Child > Category",
      "attributes": [
        {
          "attribute_id": "unique_attribute_id",
          "attribute_name": "Attribute Name",
          "attribute_type": "string",
          "required": true,
          "list_of_values": [
            {
              "value": "Value Name",
              "value_id": "unique_value_id"
            }
          ]
        }
      ]
    }
  ]
}
```

## Usage

### Running the Matcher

```bash
cd marketplace_matching/scripts
python3 marketplace_matcher.py
```

### Using the Matcher in Code

```python
from marketplace_matcher import MarketplaceMatcher
import json

# Load marketplace data
with open('data/marketplace1.json', 'r') as f:
    marketplace1 = json.load(f)

with open('data/marketplace2.json', 'r') as f:
    marketplace2 = json.load(f)

# Create matcher with custom threshold
matcher = MarketplaceMatcher(similarity_threshold=0.7)

# Match all data
results = matcher.match_all(marketplace1, marketplace2)

# Generate report
report = matcher.generate_mapping_report(results)
print(report)
```

## Matching Algorithm

### 1. Category Matching

Categories are matched using a weighted combination of:
- **Category Name** (70% weight): Direct name comparison
- **Category Path** (30% weight): Hierarchical path comparison

Example:
- Amazon: "Electronics"
- Flipkart: "Electronic Devices"
- Match Score: 0.759 ✓

### 2. Attribute Matching

Attributes are matched within already-matched categories using:
- Direct name similarity comparison
- Case-insensitive matching

Example:
- Amazon: "Color"
- Flipkart: "Colour"
- Match Score: 0.909 ✓

### 3. List of Values (LOV) Matching

LOVs are matched within already-matched attributes using:
- Normalized value comparison
- Removal of common prefixes/suffixes
- Case-insensitive matching

Example:
- Amazon: "1 Year"
- Flipkart: "12 Months"
- Match Score: 0.6+ ✓

## Similarity Threshold

The default similarity threshold is **0.6** (60% similarity).

You can adjust this when creating a matcher:

```python
# Stricter matching (fewer matches, higher confidence)
matcher = MarketplaceMatcher(similarity_threshold=0.8)

# More lenient matching (more matches, lower confidence)
matcher = MarketplaceMatcher(similarity_threshold=0.5)
```

## Example Results

### Sample Category Match
```
Match Score: 0.759
  Amazon: Electronics
  Flipkart: Electronic Devices
```

### Sample Attribute Match
```
Match Score: 0.909
  Category: Electronics <-> Electronic Devices
  Amazon: Color (Required: False)
  Flipkart: Colour (Required: False)
```

### Sample LOV Match
```
Attribute: Color <-> Colour
  Score 1.0: Black <-> Black
  Score 1.0: White <-> White
  Score 0.8: Gold <-> Golden
```

## Output Files

### 1. marketplace_matches.json
Complete matching results in JSON format, including:
- All category matches with scores
- All attribute matches with metadata
- All LOV matches with normalized values
- Summary statistics

### 2. matching_report.txt
Human-readable report containing:
- Summary of total matches
- Detailed category matches
- Detailed attribute matches
- Grouped LOV matches by attribute

## Customization

### Adding New Marketplaces

1. Create a new JSON file in `data/` following the structure above
2. Update the script to load your marketplace data
3. Run the matcher

### Adjusting Normalization Rules

Edit the `normalize_value()` method in `marketplace_matcher.py`:

```python
def normalize_value(self, value: str) -> str:
    replacements = {
        'custom_term': '',
        'another_term': 'replacement',
        # Add your custom rules here
    }
    # ... normalization logic
```

## Algorithm Details

### String Similarity
Uses Python's `difflib.SequenceMatcher` which implements:
- Longest common subsequence algorithm
- Ratio calculation based on matching blocks
- Case-insensitive comparison after normalization

### Matching Strategy
1. **Category-first**: Match categories before attributes
2. **Hierarchical**: Only match attributes within matched categories
3. **Cascading**: Only match LOVs within matched attributes
4. **Best-match**: Each item matches to its highest-scoring counterpart

## Use Cases

1. **Marketplace Integration**: Map product data when integrating multiple marketplaces
2. **Data Migration**: Transfer product catalogs between platforms
3. **Cross-platform Listing**: Synchronize product attributes across marketplaces
4. **Data Quality**: Identify inconsistencies in product taxonomies
5. **Catalog Normalization**: Create unified product schemas

## Limitations

- Requires manual review of low-confidence matches
- May not catch semantic differences (e.g., "Size" vs "Dimension")
- Assumes one-to-one mapping (doesn't handle many-to-many)
- Works best with English language data

## Future Enhancements

- Machine learning-based matching
- Support for multilingual matching
- Confidence bands (high/medium/low confidence matches)
- Interactive review and correction interface
- Historical learning from user corrections
- Many-to-many relationship mapping

## License

This is an example implementation for educational purposes.

## Author

Created as a demonstration of marketplace data matching capabilities.
