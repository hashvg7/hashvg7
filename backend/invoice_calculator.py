from datetime import datetime, timezone
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

# Product/Service Definitions from Excel Sheet 1
VARIABLE_SERVICES = {
    "orders": {"code": "O", "name": "Orders", "unit": "per order"},
    "users": {"code": "U", "name": "Users", "unit": "per user"},
    "warehouse": {"code": "WH", "name": "Warehouse", "unit": "per warehouse"},
    "darkstore": {"code": "DS", "name": "Darkstore", "unit": "per darkstore"},
    "store": {"code": "S", "name": "Store", "unit": "per store"},
    "seller_panel": {"code": "SP", "name": "Seller Panel", "unit": "per panel"},
    "fba": {"code": "FBA", "name": "FBA", "unit": "per transaction"},
    "sku": {"code": "SKU", "name": "SKU Management", "unit": "per SKU"},
    "reco": {"code": "RECO", "name": "Reconciliation", "unit": "per reco"},
    "dispute_mgmt": {"code": "DM", "name": "Dispute Management", "unit": "per dispute"},
    "listings": {"code": "L", "name": "Listings", "unit": "per listing"},
    "client_portal": {"code": "CP", "name": "Client Portal", "unit": "per access"},
}

FIXED_SERVICES = {
    "uat_server": {"code": "UAT", "name": "UAT Server", "monthly_fee": 0},  # Placeholder
    "platform_fees": {"code": "PF", "name": "Platform Fees", "monthly_fee": 0},
    "dedicated_support": {"code": "DS_FIXED", "name": "Dedicated Support", "monthly_fee": 0},
}

# Bundle Definitions from Excel Sheet 2
BUNDLES = {
    "oms": {
        "name": "OMS",
        "components": ["orders", "users"],
        "roi_weight": 50,
    },
    "wms": {
        "name": "WMS",
        "components": ["warehouse"],
        "roi_weight": 50,
    },
    "reco": {
        "name": "Reconciliation",
        "components": ["reco"],
        "roi_weight": 38,
    },
    "pf_fees": {
        "name": "Platform Fees",
        "components": ["platform_fees"],
        "roi_weight": 40,
    },
    "seller_panel": {
        "name": "Seller Panel",
        "components": ["seller_panel"],
        "roi_weight": 50,
    },
    "pim": {
        "name": "PIM",
        "components": ["listings", "sku"],
        "roi_weight": 10,
    },
    "dm": {
        "name": "Dispute Management",
        "components": ["dispute_mgmt"],
        "roi_weight": 39,
    },
    "oms_wms": {
        "name": "OMS + WMS",
        "components": ["orders", "users", "warehouse"],
        "roi_weight": 50,
    },
    "oms_wms_reco": {
        "name": "OMS + WMS + Reco",
        "components": ["orders", "users", "warehouse", "reco"],
        "roi_weight": 50,
    },
    "oms_wms_pf": {
        "name": "OMS + WMS + Platform",
        "components": ["orders", "users", "warehouse", "platform_fees"],
        "roi_weight": 20000,  # Different scale - might be base price
    },
}


class InvoiceCalculator:
    def __init__(self, db):
        self.db = db

    async def calculate_monthly_invoice(
        self,
        customer_id: str,
        year: int,
        month: int,
        usage_data: Dict[str, int] = None,
    ) -> Dict:
        """
        Calculate monthly invoice based on customer's pricing plan and usage data
        
        Args:
            customer_id: Customer identifier
            year: Invoice year
            month: Invoice month
            usage_data: Dictionary of {service_name: usage_count}
        """
        # Get customer with pricing configuration
        customer = await self.db.customers.find_one(
            {"customer_id": customer_id}, {"_id": 0}
        )
        
        if not customer:
            raise ValueError("Customer not found")

        # Get or fetch usage data
        if usage_data is None:
            usage_data = await self.get_usage_data(customer_id, year, month)

        # Get customer's rate card
        rate_card = customer.get("rate_card", {})
        bundles = customer.get("bundles", [])

        invoice_items = []
        subtotal = 0
        roi_breakdown = {}

        # Calculate variable costs based on usage
        for service_key, usage_count in usage_data.items():
            if usage_count > 0 and service_key in VARIABLE_SERVICES:
                service_info = VARIABLE_SERVICES[service_key]
                rate = rate_card.get(service_key, 0)
                
                if rate > 0:
                    line_total = usage_count * rate
                    subtotal += line_total
                    
                    invoice_items.append({
                        "service": service_info["name"],
                        "code": service_info["code"],
                        "type": "variable",
                        "quantity": usage_count,
                        "unit": service_info["unit"],
                        "rate": rate,
                        "amount": line_total,
                    })

        # Calculate fixed costs
        for service_key, service_info in FIXED_SERVICES.items():
            if rate_card.get(service_key, 0) > 0:
                monthly_fee = rate_card.get(service_key)
                subtotal += monthly_fee
                
                invoice_items.append({
                    "service": service_info["name"],
                    "code": service_info["code"],
                    "type": "fixed",
                    "quantity": 1,
                    "unit": "monthly",
                    "rate": monthly_fee,
                    "amount": monthly_fee,
                })

        # Calculate ROI breakdown by bundle
        for bundle_key in bundles:
            if bundle_key in BUNDLES:
                bundle = BUNDLES[bundle_key]
                bundle_usage = sum(
                    usage_data.get(comp, 0) 
                    for comp in bundle["components"] 
                    if comp in VARIABLE_SERVICES
                )
                
                if bundle_usage > 0:
                    # Calculate bundle contribution to total revenue
                    bundle_revenue = sum(
                        invoice_items[i]["amount"]
                        for i, item in enumerate(invoice_items)
                        if any(comp in VARIABLE_SERVICES and 
                               VARIABLE_SERVICES[comp]["name"] == item["service"]
                               for comp in bundle["components"])
                    )
                    
                    roi_breakdown[bundle["name"]] = {
                        "revenue": bundle_revenue,
                        "roi_weight": bundle["roi_weight"],
                        "usage": bundle_usage,
                    }

        # Calculate taxes (placeholder - adjust based on requirements)
        tax_rate = 0.18  # 18% GST
        tax_amount = subtotal * tax_rate
        total = subtotal + tax_amount

        return {
            "customer_id": customer_id,
            "invoice_period": f"{year}-{month:02d}",
            "invoice_date": datetime.now(timezone.utc).isoformat(),
            "items": invoice_items,
            "subtotal": subtotal,
            "tax_rate": tax_rate,
            "tax_amount": tax_amount,
            "total": total,
            "roi_breakdown": roi_breakdown,
            "usage_data": usage_data,
        }

    async def get_usage_data(
        self, customer_id: str, year: int, month: int
    ) -> Dict[str, int]:
        """
        Retrieve usage data for customer from usage_logs collection
        """
        # Placeholder for API integration
        # In production, this would fetch from usage tracking system
        usage_logs = await self.db.usage_logs.find(
            {
                "customer_id": customer_id,
                "year": year,
                "month": month,
            },
            {"_id": 0}
        ).to_list(1000)

        # Aggregate usage by service
        usage_data = {}
        for log in usage_logs:
            service = log.get("service")
            count = log.get("count", 0)
            usage_data[service] = usage_data.get(service, 0) + count

        return usage_data

    def calculate_roi_by_product(
        self, invoice_data: Dict, customer_bundles: List[str]
    ) -> Dict:
        """
        Calculate ROI contribution by product based on usage
        """
        roi_analysis = {}
        total_revenue = invoice_data["total"]
        roi_breakdown = invoice_data.get("roi_breakdown", {})

        for bundle_name, bundle_data in roi_breakdown.items():
            bundle_revenue = bundle_data["revenue"]
            roi_weight = bundle_data["roi_weight"]
            
            # Calculate ROI contribution
            if total_revenue > 0:
                revenue_percentage = (bundle_revenue / total_revenue) * 100
                weighted_roi = (revenue_percentage * roi_weight) / 100
                
                roi_analysis[bundle_name] = {
                    "revenue": bundle_revenue,
                    "revenue_percentage": revenue_percentage,
                    "roi_weight": roi_weight,
                    "weighted_roi_contribution": weighted_roi,
                    "usage": bundle_data["usage"],
                }

        return roi_analysis
