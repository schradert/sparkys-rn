import type {
	ExternalProductSheet,
	InternalProductSheet,
} from "@/constants/Products";

interface SheetsResponse {
	range: string;
	majorDimension: string;
	values: string[][];
}

export interface AuditEvent {
	id: number;
	timestamp: string;
	event_type: "create" | "archive" | "unarchive" | "quantity_update" | "edit";
	object_type: "internal_product" | "external_product" | "metadata";
	object_id: string;
	object_name: string;
	changes: string; // JSON string - only actual changes
	before_state: string; // JSON string - old state of updated item
	sheet_name: string;
	user_email: string;
}

export interface AuditEventSheet {
	id: number;
	timestamp: string;
	event_type: string;
	object_type: string;
	object_id: string;
	object_name: string;
	changes: string;
	before_state: string;
	sheet_name: string;
	user_email: string;
}

export class GoogleSheetsService {
	private baseUrl = "https://sheets.googleapis.com/v4/spreadsheets";
	private spreadsheetId: string;

	constructor(spreadsheetId: string) {
		this.spreadsheetId = spreadsheetId;
	}

	private async getUserEmail(accessToken: string): Promise<string> {
		try {
			const response = await fetch(
				"https://www.googleapis.com/oauth2/v2/userinfo",
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
				},
			);

			if (!response.ok) {
				console.error("Failed to fetch user info:", response.status);
				return "unknown";
			}

			const userInfo = await response.json();
			return userInfo.email || "unknown";
		} catch (error) {
			console.error("Error fetching user email:", error);
			return "unknown";
		}
	}

	private async makeRequest(
		endpoint: string,
		accessToken: string,
	): Promise<any> {
		const url = `${this.baseUrl}/${this.spreadsheetId}/${endpoint}`;

		console.log("Making request to:", url);

		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Sheets API error:", {
				status: response.status,
				statusText: response.statusText,
				url,
				error: errorText,
			});
			throw new Error(
				`Sheets API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}

		return response.json();
	}

	async getSheetData(
		sheetName: string,
		accessToken: string,
	): Promise<string[][]> {
		const range = `${sheetName}!A:Z`;
		const endpoint = `values/${encodeURIComponent(range)}`;
		const data: SheetsResponse = await this.makeRequest(endpoint, accessToken);

		return data.values || [];
	}

	async getMetadataValues(
		sheetName: string,
		accessToken: string,
	): Promise<any[]> {
		const values = await this.getSheetData(sheetName, accessToken);

		if (values.length === 0) return [];

		const headerRow = values[0];
		const nameColumnIndex = headerRow.findIndex(
			(header) => header.toLowerCase() === "name",
		);
		const statusColumnIndex = headerRow.findIndex(
			(header) => header.toLowerCase() === "status",
		);

		if (nameColumnIndex === -1) {
			throw new Error(`No 'name' column found in ${sheetName} sheet`);
		}

		return values
			.slice(1)
			.map((row) => ({
				name: row[nameColumnIndex] || "",
				status:
					statusColumnIndex !== -1
						? row[statusColumnIndex] || "active"
						: "active",
			}))
			.filter((item) => item.name && item.name.trim() !== "");
	}

	async getProductData(accessToken: string): Promise<ProductSheet[]> {
		const values = await this.getSheetData("products", accessToken);

		if (values.length === 0) {
			console.log("No data found in products sheet");
			return [];
		}

		const headerRow = values[0];
		const products: ProductSheet[] = [];

		console.log("Raw headers:", headerRow);

		const columnMap: { [key: string]: number } = {};
		headerRow.forEach((header, index) => {
			const normalizedHeader = header.toLowerCase().replace(/\s+/g, "_");
			columnMap[normalizedHeader] = index;
		});

		console.log("Normalized column map:", columnMap);

		const columnMappings = {
			id: ["unique_id_sku"],
			name: ["sparkys_product_name"],
			product_type: ["product_type"],
			occasion: ["occasion"],
			color: ["manufacturer_color"],
			manufacturer: ["brand"],
			size: ["size"],
			texture: ["texture"],
			quantity: ["quantity"],
			bag_quantity: ["bag_quantity"],
			shape: ["shape"],
			distributor: ["distributor"],
		};

		const resolvedColumns: { [key: string]: number } = {};

		for (const [key, possibleHeaders] of Object.entries(columnMappings)) {
			let foundIndex = -1;
			for (const header of possibleHeaders) {
				if (columnMap[header] !== undefined) {
					foundIndex = columnMap[header];
					break;
				}
			}
			if (foundIndex !== -1) {
				resolvedColumns[key] = foundIndex;
			}
		}

		console.log("Resolved columns:", resolvedColumns);

		const requiredColumns = [
			"id",
			"name",
			"product_type",
			"quantity",
			"bag_quantity",
		];
		for (const column of requiredColumns) {
			if (resolvedColumns[column] === undefined) {
				console.error(`Missing required column: ${column}`);
				throw new Error(
					`Required column for '${column}' not found in products sheet`,
				);
			}
		}

		console.log(`Processing ${values.length - 1} product rows...`);

		for (let i = 1; i < values.length; i++) {
			const row = values[i];

			if (!row[resolvedColumns.id] || row[resolvedColumns.id].trim() === "") {
				console.log(`Skipping row ${i}: empty ID`);
				continue;
			}

			try {
				const product: ProductSheet = {
					id: row[resolvedColumns.id],
					name: row[resolvedColumns.name] || "",
					product_type: row[resolvedColumns.product_type] || "",
					occasion: row[resolvedColumns.occasion] || "",
					color: row[resolvedColumns.color] || "",
					manufacturer: row[resolvedColumns.manufacturer] || "",
					size: row[resolvedColumns.size] || "",
					texture: row[resolvedColumns.texture] || "",
					quantity: parseInt(row[resolvedColumns.quantity] || "0", 10),
					bag_quantity: parseInt(row[resolvedColumns.bag_quantity] || "50", 10),
					shape: row[resolvedColumns.shape] || "",
					distributor: row[resolvedColumns.distributor] || "",
					image_url: undefined,
				};

				console.log(`Parsed product ${i}:`, product);
				products.push(product);
			} catch (error) {
				console.warn(`Error parsing product row ${i}:`, error);
			}
		}

		console.log(`Successfully parsed ${products.length} products`);

		return products;
	}

	async getInternalProductData(accessToken: string): Promise<any[]> {
		console.log("Fetching internal_products sheet...");
		const data = await this.getSheetData("internal_products", accessToken);
		console.log("Internal products sheet data:", data);
		if (!data || data.length < 2) {
			console.log("No internal products data found or insufficient rows");
			return [];
		}

		const headers = data[0];
		const values = data;

		const products: any[] = [];

		// Header: sparkys_product_name, product_type, sparkys_color, texture, shape, occasions, products, threshold_quantity, status
		for (let i = 1; i < values.length; i++) {
			const row = values[i];
			if (!row[0] || row[0].trim() === "") continue;

			const product: any = {
				sparkys_product_name: row[0] || "",
				product_type: row[1] || "",
				sparkys_color: row[2] || "",
				texture: row[3] || "",
				shape: row[4] || "",
				occasions: row[5] || "", // comma-separated
				products: row[6] || "", // comma-separated barcodes
				threshold_quantity: parseInt(row[7] || "0", 10), // Parse as integer
				status: row[8] || "active", // status field
			};
			console.log("Parsed internal product:", product);

			products.push(product);
		}

		console.log("Returning", products.length, "internal products");
		return products;
	}

	async getExternalProductData(accessToken: string): Promise<any[]> {
		console.log("Fetching external_products sheet...");
		const data = await this.getSheetData("external_products", accessToken);
		console.log("External products sheet data:", data);
		if (!data || data.length < 2) {
			console.log("No external products data found or insufficient rows");
			return [];
		}

		const headers = data[0];
		const values = data;

		const products: any[] = [];

		// Header: unique_id_sku, manufacturer_color, brand, size, bag_quantity, distributors, quantity
		for (let i = 1; i < values.length; i++) {
			const row = values[i];
			if (!row[0] || row[0].trim() === "") continue;

			const product: any = {
				unique_id_sku: row[0] || "",
				manufacturer_color: row[1] || "",
				brand: row[2] || "",
				size: row[3] || "",
				bag_quantity: parseInt(row[4] || "0", 10),
				distributors: row[5] || "", // comma-separated
				quantity: parseInt(row[6] || "0", 10),
				status: row[7] || "active", // status field
			};
			console.log("Parsed external product:", product);

			products.push(product);
		}

		console.log("Returning", products.length, "external products");
		return products;
	}

	async getAllSheetsData(accessToken: string) {
		try {
			const [
				productTypes,
				occasions,
				manufacturerColors,
				sparkyColors,
				brands,
				shapes,
				textures,
				distributors,
				bagQuantities,
				internalProducts,
				externalProducts,
			] = await Promise.all([
				this.getMetadataValues("product_types", accessToken),
				this.getMetadataValues("occasions", accessToken),
				this.getMetadataValues("manufacturer_colors", accessToken),
				this.getMetadataValues("sparkys_colors", accessToken),
				this.getMetadataValues("brands", accessToken),
				this.getMetadataValues("shapes", accessToken),
				this.getMetadataValues("textures", accessToken),
				this.getMetadataValues("distributors", accessToken),
				this.getMetadataValues("bag_quantities", accessToken),
				this.getInternalProductData(accessToken),
				this.getExternalProductData(accessToken),
			]);

			const uniqueSizes = [
				...new Set(externalProducts.map((p) => p.size).filter(Boolean)),
			].sort();

			const uniqueSizesWithStatus = uniqueSizes.map((size) => ({
				name: size,
				status: "active",
			}));

			return {
				metadata: {
					productType: productTypes
						.filter((item) => item.status === "active")
						.map((item) => item.name),
					manufacturer_color: manufacturerColors
						.filter((item) => item.status === "active")
						.map((item) => item.name),
					sparkys_color: sparkyColors
						.filter((item) => item.status === "active")
						.map((item) => item.name),
					manufacturer: brands
						.filter((item) => item.status === "active")
						.map((item) => item.name),
					size: uniqueSizes,
					texture: textures
						.filter((item) => item.status === "active")
						.map((item) => item.name),
					bagQuantity: bagQuantities
						.filter((item) => item.status === "active")
						.map((item) => item.name),
					shape: shapes
						.filter((item) => item.status === "active")
						.map((item) => item.name),
					distributor: distributors
						.filter((item) => item.status === "active")
						.map((item) => item.name),
					occasion: occasions
						.filter((item) => item.status === "active")
						.map((item) => item.name),
				},
				fullMetadata: {
					productType: productTypes,
					manufacturer_color: manufacturerColors,
					sparkys_color: sparkyColors,
					manufacturer: brands,
					size: uniqueSizesWithStatus,
					texture: textures,
					bagQuantity: bagQuantities,
					shape: shapes,
					distributor: distributors,
					occasion: occasions,
				},
				internalProducts,
				externalProducts,
			};
		} catch (error) {
			console.error("Error fetching sheets data:", error);
			throw error;
		}
	}

	async appendToSheet(
		sheetName: string,
		values: string[][],
		accessToken: string,
	): Promise<void> {
		const endpoint = `values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED`;

		const body = {
			values: values,
		};

		const response = await fetch(
			`${this.baseUrl}/${this.spreadsheetId}/${endpoint}`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Sheets append error:", {
				status: response.status,
				statusText: response.statusText,
				error: errorText,
			});
			throw new Error(
				`Failed to append to sheet: ${response.status} ${response.statusText}`,
			);
		}

		console.log(`Successfully appended ${values.length} rows to ${sheetName}`);
	}

	async getNextId(sheetName: string, accessToken: string): Promise<number> {
		const values = await this.getSheetData(sheetName, accessToken);

		if (values.length <= 1) return 1;

		const headerRow = values[0];
		const idColumnIndex = headerRow.findIndex(
			(header) => header.toLowerCase() === "id",
		);

		if (idColumnIndex === -1) return 1;

		let maxId = 0;
		for (let i = 1; i < values.length; i++) {
			const row = values[i];
			const id = parseInt(row[idColumnIndex] || "0", 10);
			if (id > maxId) {
				maxId = id;
			}
		}

		return maxId + 1;
	}

	async addMetadataItem(
		sheetName: string,
		name: string,
		accessToken: string,
	): Promise<void> {
		const nextId = await this.getNextId(sheetName, accessToken);
		const newRow = [name, nextId.toString()];

		await this.appendToSheet(sheetName, [newRow], accessToken);
		console.log(
			`Added metadata item: ${name} with id ${nextId} to ${sheetName}`,
		);

		// Log audit event
		await this.logEvent(
			{
				timestamp: new Date().toISOString(),
				event_type: "create",
				object_type: "metadata",
				object_id: nextId.toString(),
				object_name: name,
				changes: JSON.stringify({ name }),
				before_state: "",
				sheet_name: sheetName,
			},
			accessToken,
		);
	}

	async addProduct(product: ProductSheet, accessToken: string): Promise<void> {
		const newRow = [
			product.id,
			product.name,
			product.product_type,
			product.color,
			product.manufacturer,
			product.size,
			product.texture,
			product.bag_quantity.toString(),
			product.shape,
			product.distributor,
			product.occasion,
			product.quantity.toString(),
		];

		await this.appendToSheet("products", [newRow], accessToken);
		console.log(
			`Added product: ${product.name} (${product.id}) to products sheet`,
		);
	}

	async addExternalProduct(product: any, accessToken: string): Promise<void> {
		const newRow = [
			product.unique_id_sku,
			product.manufacturer_color,
			product.brand,
			product.size,
			product.bag_quantity.toString(),
			product.distributors,
			product.quantity.toString(),
			product.status || "active",
		];

		await this.appendToSheet("external_products", [newRow], accessToken);
		console.log(
			`Added external product: ${product.unique_id_sku} to external_products sheet`,
		);

		// Log audit event
		await this.logEvent(
			{
				timestamp: new Date().toISOString(),
				event_type: "create",
				object_type: "external_product",
				object_id: product.unique_id_sku,
				object_name: product.unique_id_sku,
				changes: JSON.stringify(product),
				before_state: "",
				sheet_name: "external_products",
			},
			accessToken,
		);
	}

	async updateExternalProduct(
		product: any,
		accessToken: string,
		skipAuditLog: boolean = false,
	): Promise<void> {
		// Get the current state before updating for audit log
		const currentData = await this.getSheetData(
			"external_products",
			accessToken,
		);
		const rowNumber = await this.findRowByValue(
			"external_products",
			"unique_id_sku",
			product.unique_id_sku,
			accessToken,
		);
		if (!rowNumber) {
			throw new Error(`External product "${product.unique_id_sku}" not found`);
		}

		let beforeState: any = {};
		if (!skipAuditLog && currentData.length > rowNumber - 1) {
			const currentRow = currentData[rowNumber - 1];
			beforeState = {
				unique_id_sku: currentRow[0] || "",
				manufacturer_color: currentRow[1] || "",
				brand: currentRow[2] || "",
				size: currentRow[3] || "",
				bag_quantity: parseInt(currentRow[4] || "0", 10),
				distributors: currentRow[5] || "",
				quantity: parseInt(currentRow[6] || "0", 10),
				status: currentRow[7] || "active",
			};
		}

		const updatedRow = [
			product.unique_id_sku,
			product.manufacturer_color,
			product.brand,
			product.size,
			product.bag_quantity.toString(),
			product.distributors,
			product.quantity.toString(),
			product.status || "active",
		];

		await this.updateRow(
			"external_products",
			rowNumber,
			updatedRow,
			accessToken,
		);
		console.log(`Updated external product: ${product.unique_id_sku}`);

		// Log audit event only if not skipped
		if (!skipAuditLog && Object.keys(beforeState).length > 0) {
			const changes: any = {};
			const before: any = {};

			let hasQuantityChange = false;
			let hasStatusChange = false;
			let hasOtherChanges = false;

			// Check for quantity changes
			if (beforeState.quantity !== product.quantity) {
				hasQuantityChange = true;
				changes.quantity = product.quantity;
				before.quantity = beforeState.quantity;
			}

			// Check for status changes (archive/unarchive)
			if (beforeState.status !== (product.status || "active")) {
				hasStatusChange = true;
				changes.status = product.status || "active";
				before.status = beforeState.status;
			}

			// Check for other field changes
			if (beforeState.manufacturer_color !== product.manufacturer_color) {
				hasOtherChanges = true;
				changes.manufacturer_color = product.manufacturer_color;
				before.manufacturer_color = beforeState.manufacturer_color;
			}
			if (beforeState.brand !== product.brand) {
				hasOtherChanges = true;
				changes.brand = product.brand;
				before.brand = beforeState.brand;
			}
			if (beforeState.size !== product.size) {
				hasOtherChanges = true;
				changes.size = product.size;
				before.size = beforeState.size;
			}
			if (beforeState.bag_quantity !== product.bag_quantity) {
				hasOtherChanges = true;
				changes.bag_quantity = product.bag_quantity;
				before.bag_quantity = beforeState.bag_quantity;
			}
			if (beforeState.distributors !== product.distributors) {
				hasOtherChanges = true;
				changes.distributors = product.distributors;
				before.distributors = beforeState.distributors;
			}

			// Log appropriate events based on what changed
			if (hasStatusChange && !hasQuantityChange && !hasOtherChanges) {
				// Pure archive/unarchive
				const eventType =
					(product.status || "active") === "archived" ? "archive" : "unarchive";
				await this.logEvent(
					{
						timestamp: new Date().toISOString(),
						event_type: eventType,
						object_type: "external_product",
						object_id: product.unique_id_sku,
						object_name: product.unique_id_sku,
						changes: JSON.stringify({ status: changes.status }),
						before_state: JSON.stringify({ status: before.status }),
						sheet_name: "external_products",
					},
					accessToken,
				);
			} else if (hasQuantityChange && !hasStatusChange && !hasOtherChanges) {
				// Pure quantity update
				await this.logEvent(
					{
						timestamp: new Date().toISOString(),
						event_type: "quantity_update",
						object_type: "external_product",
						object_id: product.unique_id_sku,
						object_name: product.unique_id_sku,
						changes: JSON.stringify({ quantity: changes.quantity }),
						before_state: JSON.stringify({ quantity: before.quantity }),
						sheet_name: "external_products",
					},
					accessToken,
				);
			} else if (hasOtherChanges && !hasStatusChange && !hasQuantityChange) {
				// Pure field update
				const fieldChanges = { ...changes };
				const fieldBefore = { ...before };
				delete fieldChanges.quantity;
				delete fieldChanges.status;
				delete fieldBefore.quantity;
				delete fieldBefore.status;

				await this.logEvent(
					{
						timestamp: new Date().toISOString(),
						event_type: "edit",
						object_type: "external_product",
						object_id: product.unique_id_sku,
						object_name: product.unique_id_sku,
						changes: JSON.stringify(fieldChanges),
						before_state: JSON.stringify(fieldBefore),
						sheet_name: "external_products",
					},
					accessToken,
				);
			} else {
				// Mixed update - log multiple events
				if (hasStatusChange) {
					const eventType =
						(product.status || "active") === "archived"
							? "archive"
							: "unarchive";
					await this.logEvent(
						{
							timestamp: new Date().toISOString(),
							event_type: eventType,
							object_type: "external_product",
							object_id: product.unique_id_sku,
							object_name: product.unique_id_sku,
							changes: JSON.stringify({ status: changes.status }),
							before_state: JSON.stringify({ status: before.status }),
							sheet_name: "external_products",
						},
						accessToken,
					);
				}

				if (hasQuantityChange) {
					await this.logEvent(
						{
							timestamp: new Date().toISOString(),
							event_type: "quantity_update",
							object_type: "external_product",
							object_id: product.unique_id_sku,
							object_name: product.unique_id_sku,
							changes: JSON.stringify({ quantity: changes.quantity }),
							before_state: JSON.stringify({ quantity: before.quantity }),
							sheet_name: "external_products",
						},
						accessToken,
					);
				}

				if (hasOtherChanges) {
					const fieldChanges = { ...changes };
					const fieldBefore = { ...before };
					delete fieldChanges.quantity;
					delete fieldChanges.status;
					delete fieldBefore.quantity;
					delete fieldBefore.status;

					if (Object.keys(fieldChanges).length > 0) {
						await this.logEvent(
							{
								timestamp: new Date().toISOString(),
								event_type: "edit",
								object_type: "external_product",
								object_id: product.unique_id_sku,
								object_name: product.unique_id_sku,
								changes: JSON.stringify(fieldChanges),
								before_state: JSON.stringify(fieldBefore),
								sheet_name: "external_products",
							},
							accessToken,
						);
					}
				}
			}
		}
	}

	async updateInternalProduct(
		product: any,
		accessToken: string,
	): Promise<void> {
		// Get current state before updating
		const currentData = await this.getSheetData(
			"internal_products",
			accessToken,
		);
		const rowNumber = await this.findRowByValue(
			"internal_products",
			"sparkys_product_name",
			product.sparkys_product_name,
			accessToken,
		);
		if (!rowNumber) {
			throw new Error(
				`Internal product "${product.sparkys_product_name}" not found`,
			);
		}

		// Capture current state for audit log
		let beforeState: any = {};
		if (currentData.length > rowNumber - 1) {
			const currentRow = currentData[rowNumber - 1];
			beforeState = {
				sparkys_product_name: currentRow[0] || "",
				product_type: currentRow[1] || "",
				sparkys_color: currentRow[2] || "",
				texture: currentRow[3] || "",
				shape: currentRow[4] || "",
				occasions: currentRow[5] || "",
				products: currentRow[6] || "",
				threshold_quantity: parseInt(currentRow[7] || "0", 10),
				status: currentRow[8] || "active",
			};
		}

		const updatedRow = [
			product.sparkys_product_name,
			product.product_type,
			product.sparkys_color,
			product.texture,
			product.shape,
			product.occasions,
			product.products,
			product.threshold_quantity.toString(),
			product.status || "active",
		];

		await this.updateRow(
			"internal_products",
			rowNumber,
			updatedRow,
			accessToken,
		);
		console.log(`Updated internal product: ${product.sparkys_product_name}`);

		// Log audit event with actual changes only
		if (Object.keys(beforeState).length > 0) {
			const changes: any = {};
			const before: any = {};

			// Compare fields and only include actual changes
			if (beforeState.product_type !== product.product_type) {
				changes.product_type = product.product_type;
				before.product_type = beforeState.product_type;
			}
			if (beforeState.sparkys_color !== product.sparkys_color) {
				changes.sparkys_color = product.sparkys_color;
				before.sparkys_color = beforeState.sparkys_color;
			}
			if (beforeState.texture !== product.texture) {
				changes.texture = product.texture;
				before.texture = beforeState.texture;
			}
			if (beforeState.shape !== product.shape) {
				changes.shape = product.shape;
				before.shape = beforeState.shape;
			}
			if (beforeState.occasions !== product.occasions) {
				changes.occasions = product.occasions;
				before.occasions = beforeState.occasions;
			}
			if (beforeState.products !== product.products) {
				changes.products = product.products;
				before.products = beforeState.products;
			}
			if (beforeState.threshold_quantity !== product.threshold_quantity) {
				changes.threshold_quantity = product.threshold_quantity;
				before.threshold_quantity = beforeState.threshold_quantity;
			}
			if (beforeState.status !== (product.status || "active")) {
				changes.status = product.status || "active";
				before.status = beforeState.status;
			}

			// Only log if there are actual changes
			if (Object.keys(changes).length > 0) {
				await this.logEvent(
					{
						timestamp: new Date().toISOString(),
						event_type: "edit",
						object_type: "internal_product",
						object_id: product.sparkys_product_name,
						object_name: product.sparkys_product_name,
						changes: JSON.stringify(changes),
						before_state: JSON.stringify(before),
						sheet_name: "internal_products",
					},
					accessToken,
				);
			}
		}
	}

	async archiveExternalProduct(
		sku: string,
		accessToken: string,
	): Promise<void> {
		const currentData = await this.getSheetData(
			"external_products",
			accessToken,
		);
		const rowNumber = await this.findRowByValue(
			"external_products",
			"unique_id_sku",
			sku,
			accessToken,
		);
		if (!rowNumber) {
			throw new Error(`External product "${sku}" not found`);
		}

		const currentRow = currentData[rowNumber - 1];
		const updatedRow = [...currentRow];
		updatedRow[7] = "archived"; // status column

		await this.updateRow(
			"external_products",
			rowNumber,
			updatedRow,
			accessToken,
		);
		console.log(`Archived external product: ${sku}`);

		await this.logEvent(
			{
				timestamp: new Date().toISOString(),
				event_type: "archive",
				object_type: "external_product",
				object_id: sku,
				object_name: sku,
				changes: JSON.stringify({ status: "archived" }),
				before_state: JSON.stringify({ status: "active" }),
				sheet_name: "external_products",
			},
			accessToken,
		);
	}

	async unarchiveExternalProduct(
		sku: string,
		accessToken: string,
	): Promise<void> {
		const currentData = await this.getSheetData(
			"external_products",
			accessToken,
		);
		const rowNumber = await this.findRowByValue(
			"external_products",
			"unique_id_sku",
			sku,
			accessToken,
		);
		if (!rowNumber) {
			throw new Error(`External product "${sku}" not found`);
		}

		const currentRow = currentData[rowNumber - 1];
		const updatedRow = [...currentRow];
		updatedRow[7] = "active"; // status column

		await this.updateRow(
			"external_products",
			rowNumber,
			updatedRow,
			accessToken,
		);
		console.log(`Unarchived external product: ${sku}`);

		await this.logEvent(
			{
				timestamp: new Date().toISOString(),
				event_type: "unarchive",
				object_type: "external_product",
				object_id: sku,
				object_name: sku,
				changes: JSON.stringify({ status: "active" }),
				before_state: JSON.stringify({ status: "archived" }),
				sheet_name: "external_products",
			},
			accessToken,
		);
	}

	async archiveInternalProduct(
		name: string,
		accessToken: string,
	): Promise<void> {
		const currentData = await this.getSheetData(
			"internal_products",
			accessToken,
		);
		const rowNumber = await this.findRowByValue(
			"internal_products",
			"sparkys_product_name",
			name,
			accessToken,
		);
		if (!rowNumber) {
			throw new Error(`Internal product "${name}" not found`);
		}

		const currentRow = currentData[rowNumber - 1];
		const updatedRow = [...currentRow];
		updatedRow[8] = "archived"; // status column

		await this.updateRow(
			"internal_products",
			rowNumber,
			updatedRow,
			accessToken,
		);
		console.log(`Archived internal product: ${name}`);

		await this.logEvent(
			{
				timestamp: new Date().toISOString(),
				event_type: "archive",
				object_type: "internal_product",
				object_id: name,
				object_name: name,
				changes: JSON.stringify({ status: "archived" }),
				before_state: JSON.stringify({ status: "active" }),
				sheet_name: "internal_products",
			},
			accessToken,
		);
	}

	async unarchiveInternalProduct(
		name: string,
		accessToken: string,
	): Promise<void> {
		const currentData = await this.getSheetData(
			"internal_products",
			accessToken,
		);
		const rowNumber = await this.findRowByValue(
			"internal_products",
			"sparkys_product_name",
			name,
			accessToken,
		);
		if (!rowNumber) {
			throw new Error(`Internal product "${name}" not found`);
		}

		const currentRow = currentData[rowNumber - 1];
		const updatedRow = [...currentRow];
		updatedRow[8] = "active"; // status column

		await this.updateRow(
			"internal_products",
			rowNumber,
			updatedRow,
			accessToken,
		);
		console.log(`Unarchived internal product: ${name}`);

		await this.logEvent(
			{
				timestamp: new Date().toISOString(),
				event_type: "unarchive",
				object_type: "internal_product",
				object_id: name,
				object_name: name,
				changes: JSON.stringify({ status: "active" }),
				before_state: JSON.stringify({ status: "archived" }),
				sheet_name: "internal_products",
			},
			accessToken,
		);
	}

	async findRowByValue(
		sheetName: string,
		columnName: string,
		value: string,
		accessToken: string,
	): Promise<number | null> {
		const values = await this.getSheetData(sheetName, accessToken);

		if (values.length === 0) return null;

		const headerRow = values[0];
		const columnIndex = headerRow.findIndex(
			(header) => header.toLowerCase() === columnName.toLowerCase(),
		);

		if (columnIndex === -1) return null;

		for (let i = 1; i < values.length; i++) {
			if (values[i][columnIndex] === value) {
				return i + 1; // Return 1-based row number for sheets API
			}
		}

		return null;
	}

	async updateRow(
		sheetName: string,
		rowNumber: number,
		values: string[],
		accessToken: string,
	): Promise<void> {
		const range = `${sheetName}!A${rowNumber}:Z${rowNumber}`;
		const endpoint = `values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

		const body = {
			values: [values],
		};

		const response = await fetch(
			`${this.baseUrl}/${this.spreadsheetId}/${endpoint}`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Sheets update error:", {
				status: response.status,
				statusText: response.statusText,
				error: errorText,
			});
			throw new Error(
				`Failed to update sheet: ${response.status} ${response.statusText}`,
			);
		}

		console.log(`Successfully updated row ${rowNumber} in ${sheetName}`);
	}

	async updateMetadataItem(
		sheetName: string,
		oldName: string,
		newName: string,
		accessToken: string,
	): Promise<void> {
		const rowNumber = await this.findRowByValue(
			sheetName,
			"name",
			oldName,
			accessToken,
		);
		if (!rowNumber) {
			throw new Error(`Metadata item "${oldName}" not found in ${sheetName}`);
		}

		// Get the existing row to preserve the ID
		const values = await this.getSheetData(sheetName, accessToken);
		const existingRow = values[rowNumber - 1]; // Convert to 0-based index
		const id = existingRow[1]; // ID is in second column

		// Update the metadata sheet (preserve status if it exists)
		const status = existingRow[2] || "active"; // status is in third column
		const updatedRow = [newName, id, status];
		await this.updateRow(sheetName, rowNumber, updatedRow, accessToken);
		console.log(
			`Updated metadata item from "${oldName}" to "${newName}" in ${sheetName}`,
		);

		// Log audit event
		await this.logEvent(
			{
				timestamp: new Date().toISOString(),
				event_type: "edit",
				object_type: "metadata",
				object_id: id,
				object_name: newName,
				changes: JSON.stringify({ name: newName }),
				before_state: JSON.stringify({ name: oldName }),
				sheet_name: sheetName,
			},
			accessToken,
		);

		// Update all products that use this metadata value
		await this.updateProductsWithMetadataChange(
			sheetName,
			oldName,
			newName,
			accessToken,
		);
	}

	async updateProductsWithMetadataChange(
		metadataSheetName: string,
		oldValue: string,
		newValue: string,
		accessToken: string,
	): Promise<void> {
		console.log(
			`DEBUG: Starting cascade update for ${metadataSheetName}: "${oldValue}" -> "${newValue}"`,
		);

		// Determine which product sheets need updating based on metadata type
		const sheetsToUpdate = this.getProductSheetsForMetadata(metadataSheetName);
		if (sheetsToUpdate.length === 0) {
			console.log(
				`No product sheets to update for metadata sheet: ${metadataSheetName}`,
			);
			return;
		}

		// Update each relevant product sheet
		for (const sheetInfo of sheetsToUpdate) {
			await this.updateProductSheetWithMetadataChange(
				sheetInfo.sheetName,
				sheetInfo.columnName,
				oldValue,
				newValue,
				accessToken,
			);
		}
	}

	private getProductSheetsForMetadata(metadataSheetName: string): Array<{
		sheetName: string;
		columnName: string;
	}> {
		switch (metadataSheetName) {
			case "product_types":
				return [{ sheetName: "internal_products", columnName: "product_type" }];
			case "sparkys_colors":
				return [
					{ sheetName: "internal_products", columnName: "sparkys_color" },
				];
			case "textures":
				return [{ sheetName: "internal_products", columnName: "texture" }];
			case "shapes":
				return [{ sheetName: "internal_products", columnName: "shape" }];
			case "occasions":
				return [{ sheetName: "internal_products", columnName: "occasions" }];
			case "manufacturer_colors":
				return [
					{ sheetName: "external_products", columnName: "manufacturer_color" },
				];
			case "brands":
				return [{ sheetName: "external_products", columnName: "brand" }];
			case "bag_quantities":
				return [{ sheetName: "external_products", columnName: "bag_quantity" }];
			case "distributors":
				return [{ sheetName: "external_products", columnName: "distributors" }];
			default:
				return [];
		}
	}

	private async updateProductSheetWithMetadataChange(
		sheetName: string,
		columnName: string,
		oldValue: string,
		newValue: string,
		accessToken: string,
	): Promise<void> {
		console.log(`DEBUG: Updating ${sheetName} sheet, column ${columnName}`);

		const products = await this.getSheetData(sheetName, accessToken);
		if (products.length === 0) {
			console.log(`DEBUG: No products found in ${sheetName}`);
			return;
		}

		const headerRow = products[0];
		const columnIndex = headerRow.findIndex(
			(header) => header.toLowerCase() === columnName.toLowerCase(),
		);

		if (columnIndex === -1) {
			console.log(
				`DEBUG: Column ${columnName} not found in ${sheetName}. Available columns:`,
				headerRow,
			);
			return;
		}

		// Find all products that need updating
		const rowsToUpdate: { rowNumber: number; values: string[] }[] = [];

		for (let i = 1; i < products.length; i++) {
			const row = products[i];
			const currentValue = row[columnIndex];

			// Handle comma-separated values (for occasions, distributors)
			if (columnName === "occasions" || columnName === "distributors") {
				const values = currentValue
					? currentValue.split(",").map((v) => v.trim())
					: [];
				if (values.includes(oldValue)) {
					const updatedValues = values.map((v) =>
						v === oldValue ? newValue : v,
					);
					const updatedRow = [...row];
					updatedRow[columnIndex] = updatedValues.join(", ");
					rowsToUpdate.push({
						rowNumber: i + 1,
						values: updatedRow,
					});
				}
			} else if (currentValue === oldValue) {
				const updatedRow = [...row];
				updatedRow[columnIndex] = newValue;
				rowsToUpdate.push({
					rowNumber: i + 1,
					values: updatedRow,
				});
			}
		}

		console.log(
			`DEBUG: Found ${rowsToUpdate.length} products to update in ${sheetName}`,
		);

		// Update all rows that need changing
		for (const update of rowsToUpdate) {
			await this.updateRow(
				sheetName,
				update.rowNumber,
				update.values,
				accessToken,
			);
		}

		console.log(
			`Updated ${rowsToUpdate.length} products in ${sheetName} with metadata change from "${oldValue}" to "${newValue}"`,
		);
	}

	async archiveMetadataItem(
		sheetName: string,
		name: string,
		accessToken: string,
	): Promise<void> {
		const rowNumber = await this.findRowByValue(
			sheetName,
			"name",
			name,
			accessToken,
		);
		if (!rowNumber) {
			throw new Error(`Metadata item "${name}" not found in ${sheetName}`);
		}

		// Get the existing row to preserve the ID
		const values = await this.getSheetData(sheetName, accessToken);
		const existingRow = values[rowNumber - 1]; // Convert to 0-based index
		const id = existingRow[1]; // ID is in second column

		// Update the metadata sheet with archived status
		const updatedRow = [name, id, "archived"];
		await this.updateRow(sheetName, rowNumber, updatedRow, accessToken);
		console.log(`Archived metadata item "${name}" in ${sheetName}`);

		// Log audit event
		await this.logEvent(
			{
				timestamp: new Date().toISOString(),
				event_type: "archive",
				object_type: "metadata",
				object_id: id,
				object_name: name,
				changes: JSON.stringify({ status: "archived" }),
				before_state: JSON.stringify({ status: "active" }),
				sheet_name: sheetName,
			},
			accessToken,
		);
	}

	async unarchiveMetadataItem(
		sheetName: string,
		name: string,
		accessToken: string,
	): Promise<void> {
		const rowNumber = await this.findRowByValue(
			sheetName,
			"name",
			name,
			accessToken,
		);
		if (!rowNumber) {
			throw new Error(`Metadata item "${name}" not found in ${sheetName}`);
		}

		// Get the existing row to preserve the ID
		const values = await this.getSheetData(sheetName, accessToken);
		const existingRow = values[rowNumber - 1]; // Convert to 0-based index
		const id = existingRow[1]; // ID is in second column

		// Update the metadata sheet with active status
		const updatedRow = [name, id, "active"];
		await this.updateRow(sheetName, rowNumber, updatedRow, accessToken);
		console.log(`Unarchived metadata item "${name}" in ${sheetName}`);

		// Log audit event
		await this.logEvent(
			{
				timestamp: new Date().toISOString(),
				event_type: "unarchive",
				object_type: "metadata",
				object_id: id,
				object_name: name,
				changes: JSON.stringify({ status: "active" }),
				before_state: JSON.stringify({ status: "archived" }),
				sheet_name: sheetName,
			},
			accessToken,
		);
	}

	async updateProduct(
		product: ProductSheet,
		accessToken: string,
	): Promise<void> {
		const rowNumber = await this.findRowByValue(
			"products",
			"unique_id_sku",
			product.id,
			accessToken,
		);
		if (!rowNumber) {
			throw new Error(`Product with ID "${product.id}" not found`);
		}

		const updatedRow = [
			product.id, // Keep existing ID
			product.name, // Keep existing name (not editable)
			product.product_type,
			product.color,
			product.manufacturer,
			product.size,
			product.texture,
			product.bag_quantity.toString(),
			product.shape,
			product.distributor,
			product.occasion,
			product.quantity.toString(),
		];

		await this.updateRow("products", rowNumber, updatedRow, accessToken);
		console.log(`Updated product: ${product.name} (${product.id})`);
	}

	// Audit Log Functions
	async logEvent(
		event: Omit<AuditEvent, "id" | "user_email">,
		accessToken: string,
	): Promise<void> {
		try {
			const [nextId, userEmail] = await Promise.all([
				this.getNextId("events", accessToken),
				this.getUserEmail(accessToken),
			]);

			const newRow = [
				nextId.toString(),
				event.timestamp,
				event.event_type,
				event.object_type,
				event.object_id,
				event.object_name,
				event.changes,
				event.before_state || "",
				event.sheet_name,
				userEmail,
			];

			await this.appendToSheet("events", [newRow], accessToken);
			console.log(
				`Logged audit event: ${event.event_type} ${event.object_type} ${event.object_name} by ${userEmail}`,
			);
		} catch (error) {
			console.error("Failed to log audit event:", error);
		}
	}

	async getAuditEvents(
		accessToken: string,
		limit: number = 50,
		offset: number = 0,
	): Promise<AuditEvent[]> {
		try {
			const values = await this.getSheetData("events", accessToken);

			if (values.length <= 1) return [];

			const events: AuditEvent[] = [];
			for (let i = 1; i < values.length; i++) {
				const row = values[i];
				if (row.length >= 10) {
					events.push({
						id: parseInt(row[0] || "0", 10),
						timestamp: row[1] || "",
						event_type: row[2] as AuditEvent["event_type"],
						object_type: row[3] as AuditEvent["object_type"],
						object_id: row[4] || "",
						object_name: row[5] || "",
						changes: row[6] || "",
						before_state: row[7] || "",
						sheet_name: row[8] || "",
						user_email: row[9] || "unknown",
					});
				}
			}

			// Sort by ID descending (most recent first)
			events.sort((a, b) => b.id - a.id);

			// Apply pagination
			return events.slice(offset, offset + limit);
		} catch (error) {
			console.error("Failed to fetch audit events:", error);
			return [];
		}
	}
}
