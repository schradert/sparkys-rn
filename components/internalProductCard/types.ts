import type { ExternalProduct, InternalProduct } from "@/constants/Products";
import type { AuditEvent } from "@/services/googleSheets";

export interface InternalProductCardProps {
	internalProduct: InternalProduct;
	externalProducts: ExternalProduct[];
	events?: AuditEvent[];
	onMetadataPress?: (field: string, value: string) => void;
	selectedFilters?: {
		internal?: {
			product_type?: string[];
			texture?: string[];
			shape?: string[];
			occasions?: string[];
			sparkys_color?: string[];
		};
		external?: {
			manufacturer_color?: string[];
			brand?: string[];
			size?: string[];
			distributors?: string[];
			showArchived?: boolean;
		};
	};
}
