/**
 * Utility functions for normalizing and formatting phone numbers for WhatsApp
 */

/**
 * Formats any phone number into standard international WhatsApp format starting with '62'
 * Examples:
 * - '08123456789' -> '628123456789'
 * - '+628123456789' -> '628123456789'
 * - '628123456789' -> '628123456789'
 * - '8123456789' -> '628123456789'
 * - '+62 812-3456-7890' -> '6281234567890'
 * - '006281234567890' -> '6281234567890'
 */
export const formatWhatsAppNumber = (phone: string | number | null | undefined): string => {
  if (phone === null || phone === undefined) return '';
  const phoneStr = String(phone).trim();
  if (!phoneStr) return '';

  // Remove all non-digit characters (+, spaces, hyphens, dots, parentheses, etc.)
  let digits = phoneStr.replace(/\D/g, '');
  if (!digits) return '';

  // Handle leading 0062 -> remove leading 00
  if (digits.startsWith('0062')) {
    digits = digits.substring(2);
  }
  // Handle leading 620 -> convert to 62 (e.g. 620812 -> 62812)
  if (digits.startsWith('620')) {
    digits = '62' + digits.substring(3);
  }
  // If starts with 0 -> replace '0' with '62'
  else if (digits.startsWith('0')) {
    digits = '62' + digits.substring(1);
  }
  // If starts with 8 -> prepend '62'
  else if (digits.startsWith('8')) {
    digits = '62' + digits;
  }
  // If already starts with 62 -> leave as is
  
  return digits;
};

/**
 * Normalizes an Indonesian phone number to standard '08...' format for database storage.
 * Examples:
 * - '81234567890' -> '081234567890'
 * - '+6281234567890' -> '081234567890'
 * - '6281234567890' -> '081234567890'
 * - '081234567890' -> '081234567890'
 */
export const normalizePhone = (phone: string | number | null | undefined): string | null => {
  if (phone === null || phone === undefined) return null;
  const phoneStr = String(phone).trim();
  if (!phoneStr) return null;

  // Remove all non-digit characters
  let digits = phoneStr.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('0062')) {
    digits = '0' + digits.substring(4);
  } else if (digits.startsWith('620')) {
    digits = '0' + digits.substring(3);
  } else if (digits.startsWith('62')) {
    digits = '0' + digits.substring(2);
  } else if (digits.startsWith('8')) {
    digits = '0' + digits;
  }

  return digits || null;
};
