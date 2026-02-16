#!/usr/bin/env python3
"""
Example usage of the Marketplace Matcher

This script demonstrates how to use the MarketplaceMatcher class
with custom data or different similarity thresholds.
"""

import json
from marketplace_matcher import MarketplaceMatcher


def example_basic_usage():
    """Basic usage example with existing data files"""
    print("=" * 80)
    print("EXAMPLE 1: Basic Usage")
    print("=" * 80)
    print()

    # Load marketplace data
    with open('../data/amazon_marketplace.json', 'r') as f:
        amazon = json.load(f)

    with open('../data/flipkart_marketplace.json', 'r') as f:
        flipkart = json.load(f)

    # Create matcher with default threshold (0.6)
    matcher = MarketplaceMatcher()

    # Match categories only
    category_matches = matcher.match_categories(amazon, flipkart)
    print(f"Found {len(category_matches)} category matches")
    for match in category_matches:
        print(f"  - {match['category1']['name']} <-> {match['category2']['name']} (score: {match['similarity_score']})")

    print()


def example_custom_threshold():
    """Example with custom similarity threshold"""
    print("=" * 80)
    print("EXAMPLE 2: Custom Similarity Threshold")
    print("=" * 80)
    print()

    # Load marketplace data
    with open('../data/amazon_marketplace.json', 'r') as f:
        amazon = json.load(f)

    with open('../data/flipkart_marketplace.json', 'r') as f:
        flipkart = json.load(f)

    # Try different thresholds
    thresholds = [0.5, 0.7, 0.9]

    for threshold in thresholds:
        matcher = MarketplaceMatcher(similarity_threshold=threshold)
        matches = matcher.match_all(amazon, flipkart)

        print(f"Threshold: {threshold}")
        print(f"  Category matches: {matches['summary']['total_category_matches']}")
        print(f"  Attribute matches: {matches['summary']['total_attribute_matches']}")
        print(f"  LOV matches: {matches['summary']['total_lov_matches']}")
        print()


def example_attribute_matching():
    """Example focusing on attribute matching"""
    print("=" * 80)
    print("EXAMPLE 3: Attribute Matching Details")
    print("=" * 80)
    print()

    # Load marketplace data
    with open('../data/amazon_marketplace.json', 'r') as f:
        amazon = json.load(f)

    with open('../data/flipkart_marketplace.json', 'r') as f:
        flipkart = json.load(f)

    # Create matcher
    matcher = MarketplaceMatcher(similarity_threshold=0.6)

    # Match attributes
    attribute_matches = matcher.match_attributes(amazon, flipkart)

    print(f"Found {len(attribute_matches)} attribute matches:\n")
    for match in attribute_matches:
        print(f"Category: {match['category1_name']}")
        print(f"  Amazon: {match['attribute1']['name']} (Required: {match['attribute1']['required']})")
        print(f"  Flipkart: {match['attribute2']['name']} (Required: {match['attribute2']['required']})")
        print(f"  Similarity: {match['similarity_score']}")
        print()


def example_lov_matching():
    """Example focusing on list of values matching"""
    print("=" * 80)
    print("EXAMPLE 4: List of Values Matching")
    print("=" * 80)
    print()

    # Load marketplace data
    with open('../data/amazon_marketplace.json', 'r') as f:
        amazon = json.load(f)

    with open('../data/flipkart_marketplace.json', 'r') as f:
        flipkart = json.load(f)

    # Create matcher
    matcher = MarketplaceMatcher(similarity_threshold=0.6)

    # Match LOVs
    lov_matches = matcher.match_list_of_values(amazon, flipkart)

    # Group by attribute
    from collections import defaultdict
    by_attribute = defaultdict(list)

    for match in lov_matches:
        key = f"{match['attribute1_name']} <-> {match['attribute2_name']}"
        by_attribute[key].append(match)

    print(f"Found {len(lov_matches)} LOV matches across {len(by_attribute)} attributes:\n")

    for attribute, matches in by_attribute.items():
        print(f"Attribute: {attribute}")
        for match in matches:
            print(f"  {match['value1']['value']} <-> {match['value2']['value']} (score: {match['similarity_score']})")
        print()


def example_custom_data():
    """Example with custom marketplace data"""
    print("=" * 80)
    print("EXAMPLE 5: Custom Marketplace Data")
    print("=" * 80)
    print()

    # Create custom marketplace data
    marketplace_a = {
        "marketplace_name": "Marketplace A",
        "marketplace_id": "marketplace_a",
        "categories": [
            {
                "category_id": "cat_a_1",
                "category_name": "Books",
                "category_path": "Books",
                "attributes": [
                    {
                        "attribute_id": "attr_a_1",
                        "attribute_name": "Author",
                        "attribute_type": "string",
                        "required": True,
                        "list_of_values": [
                            {"value": "Fiction", "value_id": "fiction"},
                            {"value": "Non-Fiction", "value_id": "non_fiction"}
                        ]
                    }
                ]
            }
        ]
    }

    marketplace_b = {
        "marketplace_name": "Marketplace B",
        "marketplace_id": "marketplace_b",
        "categories": [
            {
                "category_id": "cat_b_1",
                "category_name": "Book Store",
                "category_path": "Books",
                "attributes": [
                    {
                        "attribute_id": "attr_b_1",
                        "attribute_name": "Writer",
                        "attribute_type": "text",
                        "required": True,
                        "list_of_values": [
                            {"value": "Fiction", "value_id": "fic"},
                            {"value": "Non Fiction", "value_id": "nonfic"}
                        ]
                    }
                ]
            }
        ]
    }

    # Match custom data
    matcher = MarketplaceMatcher(similarity_threshold=0.5)
    matches = matcher.match_all(marketplace_a, marketplace_b)

    # Print results
    print(f"Category matches: {len(matches['category_matches'])}")
    print(f"Attribute matches: {len(matches['attribute_matches'])}")
    print(f"LOV matches: {len(matches['lov_matches'])}")
    print()

    if matches['category_matches']:
        print("Category match:")
        for match in matches['category_matches']:
            print(f"  {match['category1']['name']} <-> {match['category2']['name']}")

    if matches['attribute_matches']:
        print("\nAttribute match:")
        for match in matches['attribute_matches']:
            print(f"  {match['attribute1']['name']} <-> {match['attribute2']['name']}")

    print()


def main():
    """Run all examples"""
    example_basic_usage()
    example_custom_threshold()
    example_attribute_matching()
    example_lov_matching()
    example_custom_data()


if __name__ == "__main__":
    main()
