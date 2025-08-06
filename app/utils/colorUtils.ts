
// A mapping of brand names to their hex color codes.
const brandColors: { [key: string]: string } = {
    "American Airlines": "#36495A",
    "Agoda": "#FF2938",
    "AMEX": "#016FD0",
    "Avis": "#D4002A",
    "Budget": "#D4002A",
    "Blacklane": "#000000",
    "Capital One Travel": "#D22E1E",
    "Delta": "#003366",
    "Delta Sky Club": "#003366",
    "Expedia": "#1E243A",
    "JSX": "#c82e2c",
    "Lyft": "#FF00BF",
    "Priority Pass Select": "#827127",
    "Resy": "#ff462d",
    "StubHub": "#5224ae",
    "Uber": "#000000",
    "UberEats": "#06C167",
    "United Airlines": "#0033A0",
    "viagogo": "#6fb229",
    "Hilton": "#1E4380",
    "IHG": "#000000",
    "Marriott Bonvoy": "#ee8a64",
    "Renowned Hotels and Resorts": "#0033A0",
    "St. Regis": "#ee8a64",
    "The Ritz-Carlton": "#000000",
    "DashPass": "#EB1700",
    "Dunkin'": "#EF6A00",
    "Five Guys": "#D21033",
    "Grubhub": "#FF8000",
    "Instacart": "#003D29",
    "Apple": "#000000",
    "Bank of America": "#E31837",
    "Best Buy": "#FFF200",
    "Chase": "#005EB8",
    "Citi": "#255BE3",
    "City National Bank (CNB)": "#4374b9",
    "Costco": "#E32A36",
    "DoorDash": "#EB1700",
    "Equinox": "#000000",
    "HSBC": "#EE3524",
    "JPMorgan": "#000000",
    "Peloton": "#000000",
    "Saks Fifth Avenue": "#000000",
    "U.S. Bank": "#CF2A36",
    "Walmart+": "#0071ce",
    "TSA Pre": "#24487b",
    "CLEAR": "#041a55",
};

/**
 * Determines the best contrast text color (black or white) for a given background color.
 * Uses the WCAG relative luminance calculation to determine contrast.
 *
 * @param backgroundColor - The background color in hex format (e.g., "#FF0000")
 * @returns "#FFFFFF" for white or "#000000" for black
 */
export function getTextColor(backgroundColor: string | null | undefined): string {
    if (!backgroundColor) return "#000000";

    // Remove the hash if present
    const hex = backgroundColor.replace('#', '');

    // Convert hex to RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    // Calculate relative luminance using WCAG formula
    const luminance = 0.2126 * toSRGB(r) + 0.7152 * toSRGB(g) + 0.0722 * toSRGB(b);

    // Use white text if background is dark (luminance < 0.5)
    return luminance < 0.5 ? "#FFFFFF" : "#000000";
}

/**
 * Helper function to convert RGB values to sRGB for luminance calculation
 */
function toSRGB(value: number): number {
    return value <= 0.03928
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
}

// For better type-safety, we can define a type for the available brands.
export type BrandName = keyof typeof brandColors;

/**
 * Retrieves the hex color code for a given brand name.
 * The search is case-insensitive.
 *
 * @param brandName - The name of the brand to look up.
 * @returns The hex color code as a string if found, otherwise undefined.
 */
export function getBrandColor(brandName: string|null|undefined): string | undefined {
    console.log(brandName);
    if(!brandName) return 'blue';

    const lowerCaseBrandName = brandName.toLowerCase();

    // Find the matching key in our brandColors object regardless of case
    const foundKey = Object.keys(brandColors).find(
        (key) => key.toLowerCase() === lowerCaseBrandName
    );

    return foundKey ? brandColors[foundKey] : undefined;
}
