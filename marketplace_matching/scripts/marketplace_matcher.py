#!/usr/bin/env python3
"""
Marketplace Data Matcher
Matches categories, attributes, and list of values (LOV) between different marketplaces
"""

import json
import difflib
from typing import Dict, List, Tuple, Any
from collections import defaultdict


class MarketplaceMatcher:
    """Matches marketplace data including categories, attributes, and LOVs"""

    def __init__(self, similarity_threshold: float = 0.6):
        """
        Initialize the matcher with a similarity threshold

        Args:
            similarity_threshold: Minimum similarity score (0-1) to consider a match
        """
        self.similarity_threshold = similarity_threshold
        self.category_matches = []
        self.attribute_matches = []
        self.lov_matches = []

    def calculate_similarity(self, str1: str, str2: str) -> float:
        """
        Calculate similarity between two strings using SequenceMatcher

        Args:
            str1: First string
            str2: Second string

        Returns:
            Similarity score between 0 and 1
        """
        # Normalize strings: lowercase and strip whitespace
        str1_norm = str1.lower().strip()
        str2_norm = str2.lower().strip()

        # Calculate similarity
        similarity = difflib.SequenceMatcher(None, str1_norm, str2_norm).ratio()
        return similarity

    def normalize_value(self, value: str) -> str:
        """
        Normalize a value for better matching

        Args:
            value: Value to normalize

        Returns:
            Normalized value
        """
        # Convert to lowercase
        normalized = value.lower().strip()

        # Remove common suffixes/prefixes
        replacements = {
            'inc.': '',
            'corporation': '',
            'technologies': '',
            'electronics': '',
            '100%': '',
            'pure': '',
            'brand': '',
        }

        for old, new in replacements.items():
            normalized = normalized.replace(old, new)

        # Remove extra whitespace
        normalized = ' '.join(normalized.split())

        return normalized

    def match_categories(self, marketplace1: Dict, marketplace2: Dict) -> List[Dict]:
        """
        Match categories between two marketplaces

        Args:
            marketplace1: First marketplace data
            marketplace2: Second marketplace data

        Returns:
            List of category matches
        """
        matches = []

        categories1 = marketplace1.get('categories', [])
        categories2 = marketplace2.get('categories', [])

        for cat1 in categories1:
            best_match = None
            best_score = 0

            for cat2 in categories2:
                # Calculate similarity for category name
                name_similarity = self.calculate_similarity(
                    cat1['category_name'],
                    cat2['category_name']
                )

                # Calculate similarity for category path
                path_similarity = self.calculate_similarity(
                    cat1['category_path'],
                    cat2['category_path']
                )

                # Combined score (weighted average)
                combined_score = (name_similarity * 0.7) + (path_similarity * 0.3)

                if combined_score > best_score and combined_score >= self.similarity_threshold:
                    best_score = combined_score
                    best_match = cat2

            if best_match:
                match = {
                    'marketplace1': marketplace1['marketplace_name'],
                    'marketplace2': marketplace2['marketplace_name'],
                    'category1': {
                        'id': cat1['category_id'],
                        'name': cat1['category_name'],
                        'path': cat1['category_path']
                    },
                    'category2': {
                        'id': best_match['category_id'],
                        'name': best_match['category_name'],
                        'path': best_match['category_path']
                    },
                    'similarity_score': round(best_score, 3),
                    'match_type': 'category'
                }
                matches.append(match)

        self.category_matches = matches
        return matches

    def match_attributes(self, marketplace1: Dict, marketplace2: Dict) -> List[Dict]:
        """
        Match attributes between two marketplaces within matched categories

        Args:
            marketplace1: First marketplace data
            marketplace2: Second marketplace data

        Returns:
            List of attribute matches
        """
        matches = []

        # First, ensure we have category matches
        if not self.category_matches:
            self.match_categories(marketplace1, marketplace2)

        # Match attributes within matched categories
        for cat_match in self.category_matches:
            cat1_id = cat_match['category1']['id']
            cat2_id = cat_match['category2']['id']

            # Find the category objects
            cat1 = next((c for c in marketplace1['categories'] if c['category_id'] == cat1_id), None)
            cat2 = next((c for c in marketplace2['categories'] if c['category_id'] == cat2_id), None)

            if not cat1 or not cat2:
                continue

            attributes1 = cat1.get('attributes', [])
            attributes2 = cat2.get('attributes', [])

            for attr1 in attributes1:
                best_match = None
                best_score = 0

                for attr2 in attributes2:
                    # Calculate similarity for attribute name
                    similarity = self.calculate_similarity(
                        attr1['attribute_name'],
                        attr2['attribute_name']
                    )

                    if similarity > best_score and similarity >= self.similarity_threshold:
                        best_score = similarity
                        best_match = attr2

                if best_match:
                    match = {
                        'marketplace1': marketplace1['marketplace_name'],
                        'marketplace2': marketplace2['marketplace_name'],
                        'category1_name': cat_match['category1']['name'],
                        'category2_name': cat_match['category2']['name'],
                        'attribute1': {
                            'id': attr1['attribute_id'],
                            'name': attr1['attribute_name'],
                            'type': attr1['attribute_type'],
                            'required': attr1['required']
                        },
                        'attribute2': {
                            'id': best_match['attribute_id'],
                            'name': best_match['attribute_name'],
                            'type': best_match['attribute_type'],
                            'required': best_match['required']
                        },
                        'similarity_score': round(best_score, 3),
                        'match_type': 'attribute'
                    }
                    matches.append(match)

        self.attribute_matches = matches
        return matches

    def match_list_of_values(self, marketplace1: Dict, marketplace2: Dict) -> List[Dict]:
        """
        Match list of values (LOV) between two marketplaces within matched attributes

        Args:
            marketplace1: First marketplace data
            marketplace2: Second marketplace data

        Returns:
            List of LOV matches
        """
        matches = []

        # Ensure we have attribute matches
        if not self.attribute_matches:
            self.match_attributes(marketplace1, marketplace2)

        # Match LOVs within matched attributes
        for attr_match in self.attribute_matches:
            attr1_id = attr_match['attribute1']['id']
            attr2_id = attr_match['attribute2']['id']

            # Find the attribute objects
            attr1 = None
            attr2 = None

            for cat in marketplace1['categories']:
                for attr in cat.get('attributes', []):
                    if attr['attribute_id'] == attr1_id:
                        attr1 = attr
                        break
                if attr1:
                    break

            for cat in marketplace2['categories']:
                for attr in cat.get('attributes', []):
                    if attr['attribute_id'] == attr2_id:
                        attr2 = attr
                        break
                if attr2:
                    break

            if not attr1 or not attr2:
                continue

            lov1 = attr1.get('list_of_values', [])
            lov2 = attr2.get('list_of_values', [])

            for val1 in lov1:
                best_match = None
                best_score = 0

                for val2 in lov2:
                    # Calculate similarity for normalized values
                    norm_val1 = self.normalize_value(val1['value'])
                    norm_val2 = self.normalize_value(val2['value'])

                    similarity = self.calculate_similarity(norm_val1, norm_val2)

                    if similarity > best_score and similarity >= self.similarity_threshold:
                        best_score = similarity
                        best_match = val2

                if best_match:
                    match = {
                        'marketplace1': marketplace1['marketplace_name'],
                        'marketplace2': marketplace2['marketplace_name'],
                        'category1_name': attr_match['category1_name'],
                        'category2_name': attr_match['category2_name'],
                        'attribute1_name': attr_match['attribute1']['name'],
                        'attribute2_name': attr_match['attribute2']['name'],
                        'value1': {
                            'value': val1['value'],
                            'value_id': val1['value_id']
                        },
                        'value2': {
                            'value': best_match['value'],
                            'value_id': best_match['value_id']
                        },
                        'similarity_score': round(best_score, 3),
                        'match_type': 'list_of_values'
                    }
                    matches.append(match)

        self.lov_matches = matches
        return matches

    def match_all(self, marketplace1: Dict, marketplace2: Dict) -> Dict[str, List]:
        """
        Perform all matching operations

        Args:
            marketplace1: First marketplace data
            marketplace2: Second marketplace data

        Returns:
            Dictionary containing all matches
        """
        category_matches = self.match_categories(marketplace1, marketplace2)
        attribute_matches = self.match_attributes(marketplace1, marketplace2)
        lov_matches = self.match_list_of_values(marketplace1, marketplace2)

        return {
            'category_matches': category_matches,
            'attribute_matches': attribute_matches,
            'lov_matches': lov_matches,
            'summary': {
                'total_category_matches': len(category_matches),
                'total_attribute_matches': len(attribute_matches),
                'total_lov_matches': len(lov_matches)
            }
        }

    def generate_mapping_report(self, matches: Dict[str, List]) -> str:
        """
        Generate a human-readable mapping report

        Args:
            matches: Dictionary containing all matches

        Returns:
            Formatted report string
        """
        report = []
        report.append("=" * 80)
        report.append("MARKETPLACE DATA MATCHING REPORT")
        report.append("=" * 80)
        report.append("")

        # Summary
        summary = matches.get('summary', {})
        report.append("SUMMARY:")
        report.append(f"  Total Category Matches: {summary.get('total_category_matches', 0)}")
        report.append(f"  Total Attribute Matches: {summary.get('total_attribute_matches', 0)}")
        report.append(f"  Total LOV Matches: {summary.get('total_lov_matches', 0)}")
        report.append("")

        # Category matches
        report.append("-" * 80)
        report.append("CATEGORY MATCHES:")
        report.append("-" * 80)
        for match in matches.get('category_matches', []):
            report.append(f"\nMatch Score: {match['similarity_score']}")
            report.append(f"  {match['marketplace1']}: {match['category1']['name']}")
            report.append(f"  {match['marketplace2']}: {match['category2']['name']}")
        report.append("")

        # Attribute matches
        report.append("-" * 80)
        report.append("ATTRIBUTE MATCHES:")
        report.append("-" * 80)
        for match in matches.get('attribute_matches', []):
            report.append(f"\nMatch Score: {match['similarity_score']}")
            report.append(f"  Category: {match['category1_name']} <-> {match['category2_name']}")
            report.append(f"  {match['marketplace1']}: {match['attribute1']['name']} (Required: {match['attribute1']['required']})")
            report.append(f"  {match['marketplace2']}: {match['attribute2']['name']} (Required: {match['attribute2']['required']})")
        report.append("")

        # LOV matches
        report.append("-" * 80)
        report.append("LIST OF VALUES MATCHES:")
        report.append("-" * 80)

        # Group by attribute
        lov_by_attribute = defaultdict(list)
        for match in matches.get('lov_matches', []):
            key = (match['attribute1_name'], match['attribute2_name'])
            lov_by_attribute[key].append(match)

        for (attr1, attr2), lov_list in lov_by_attribute.items():
            report.append(f"\nAttribute: {attr1} <-> {attr2}")
            for match in lov_list:
                report.append(f"  Score {match['similarity_score']}: {match['value1']['value']} <-> {match['value2']['value']}")

        report.append("")
        report.append("=" * 80)

        return "\n".join(report)


def main():
    """Main execution function"""

    # Load marketplace data
    print("Loading marketplace data...")

    with open('../data/amazon_marketplace.json', 'r') as f:
        amazon_data = json.load(f)

    with open('../data/flipkart_marketplace.json', 'r') as f:
        flipkart_data = json.load(f)

    print(f"Loaded {amazon_data['marketplace_name']} marketplace data")
    print(f"Loaded {flipkart_data['marketplace_name']} marketplace data")
    print()

    # Create matcher instance
    matcher = MarketplaceMatcher(similarity_threshold=0.6)

    # Perform matching
    print("Matching marketplace data...")
    all_matches = matcher.match_all(amazon_data, flipkart_data)

    # Save results to JSON
    output_file = '../output/marketplace_matches.json'
    with open(output_file, 'w') as f:
        json.dump(all_matches, f, indent=2)
    print(f"Saved matching results to {output_file}")

    # Generate and save report
    report = matcher.generate_mapping_report(all_matches)
    report_file = '../output/matching_report.txt'
    with open(report_file, 'w') as f:
        f.write(report)
    print(f"Saved matching report to {report_file}")

    # Print report to console
    print("\n" + report)


if __name__ == "__main__":
    main()
