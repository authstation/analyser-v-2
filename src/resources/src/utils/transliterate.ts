/**
 * Phonetic Transliteration and Bengali Commercial Terms Dictionary
 * Helps convert English commercial names and addresses to Bengali phonetic spelling.
 */

export const BENGALI_COMMERCIAL_DICT: Record<string, string> = {
  "m/s": "মেসার্স",
  "m/s.": "মেসার্স",
  "ms": "মেসার্স",
  "ms.": "মেসার্স",
  "cloth": "ক্লথ",
  "clothes": "ক্লথস",
  "store": "স্টোর",
  "stores": "স্টোরস",
  "enterprise": "এন্টারপ্রাইজ",
  "enterprises": "এন্টারপ্রাইজ",
  "traders": "ট্রেডার্স",
  "trader": "ট্রেডার",
  "trading": "ট্রেডিং",
  "agency": "এজেন্সি",
  "agencies": "এজেন্সিজ",
  "brothers": "ব্রাদার্স",
  "brother": "ব্রাদার",
  "sons": "সন্স",
  "son": "সন",
  "textile": "টেক্সটাইল",
  "textiles": "টেক্সটাইলস",
  "fabrics": "ফেব্রিক্স",
  "fabric": "ফেব্রিক",
  "corporation": "কর্পোরেশন",
  "company": "কোম্পানী",
  "co": "কোং",
  "co.": "কোং",
  "ltd": "লিমিটেড",
  "ltd.": "লিমিটেড",
  "limited": "লিমিটেড",
  "pvt": "প্রাঃ",
  "pvt.": "প্রাঃ",
  "house": "হাউজ",
  "fashion": "ফ্যাশন",
  "garments": "গার্মেন্টস",
  "garment": "গার্মেন্ট",
  "variety": "ভ্যারাইটি",
  "general": "জেনারেল",
  "hardware": "হার্ডওয়্যার",
  "electric": "ইলেকট্রিক",
  "electronic": "ইলেকট্রনিক",
  "electronics": "ইলেকট্রনিক্স",
  "motors": "মোটরস",
  "motor": "মোটর",
  "auto": "অটো",
  "fertilizer": "ফার্টিলাইজার",
  "jewellers": "জুয়েলার্স",
  "jeweller": "জুয়েলার",
  "jewelry": "জুয়েলারি",
  "pharmacy": "ফার্মেসী",
  "pharma": "ফার্মা",
  "medical": "মেডিকেল",
  "sanitary": "স্যানিটারি",
  "steel": "স্টিল",
  "mills": "মিলস",
  "mill": "মিল",
  "food": "ফুড",
  "foods": "ফুডস",
  "hotel": "হোটেল",
  "restaurant": "রেস্টুরেন্ট",
  "center": "সেন্টার",
  "centre": "সেন্টার",
  "point": "পয়েন্ট",
  "corner": "কর্ণার",
  "plaza": "প্লাজা",
  "market": "মার্কেট",
  "complex": "কমপ্লেক্স",
  "engineering": "ইঞ্জিনিয়ারিং",
  "works": "ওয়ার্কস",
  "workshop": "ওয়ার্কশপ",
  "printing": "প্রিন্টিং",
  "press": "প্রেস",
  "pub": "পাব",
  "distributors": "ডিস্ট্রিউটরস",
  "distributor": "ডিস্ট্রিবিউটর",
  "supply": "সাপ্লাই",
  "suppliers": "সাপ্লায়ার্স",
  "syndicate": "সিন্ডিকেট",
  "oil": "অয়েল",
  "timber": "টিম্বার",
  "fuel": "ফুয়েল",
  "filling": "ফিলিং",
  "station": "স্টেশন",
  "road": "রোড",
  "rd": "রোড",
  "rd.": "রোড",
  "street": "স্ট্রিট",
  "lane": "লেন",
  "sector": "সেক্টর",
  "block": "ব্লক",
  "ward": "ওয়ার্ড",
  "holding": "হোল্ডিং",
  "bazar": "বাজার",
  "bazaar": "বাজার",
  "sadar": "সদর",
  "thana": "থানা",
  "district": "জেলা",
  "post": "পোস্ট",
  "chawk": "চক",
  "chowk": "চক",
  "mor": "মোড়",
  "more": "মোড়",
  "goli": "গলি",
  "para": "পাড়া",
  "nagar": "নগর",
  "pur": "পুর",
  "village": "গ্রাম",
  "vill": "গ্রাম",
  "po": "ডাকঘর",
  "p.o": "ডাকঘর",
  "ps": "থানা",
  "p.s": "থানা"
};

const transliterateCache = new Map<string, string>();

/**
 * Transliterates English text (name, address) to Bengali phonetically.
 * Uses local commercial dictionary and Google Input Tools API with in-memory caching.
 */
export const transliterateToBengali = async (text: string): Promise<string> => {
  if (!text) return "";
  // Check if string already contains mostly Bengali characters
  if (/[\u0980-\u09FF]/.test(text)) return text;

  if (transliterateCache.has(text)) {
    return transliterateCache.get(text)!;
  }

  // Split comma-separated parts (useful for multi-part addresses)
  const parts = text.split(",");
  const translatedParts: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (/[\u0980-\u09FF]/.test(trimmed)) {
      translatedParts.push(trimmed);
      continue;
    }

    const tokens = trimmed.split(/\s+/);
    const result: string[] = [];

    for (const token of tokens) {
      const clean = token.toLowerCase();
      if (BENGALI_COMMERCIAL_DICT[clean]) {
        result.push(BENGALI_COMMERCIAL_DICT[clean]);
        continue;
      }
      // Remove trailing dots/commas to check dictionary again
      const stripped = clean.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
      if (BENGALI_COMMERCIAL_DICT[stripped]) {
        result.push(BENGALI_COMMERCIAL_DICT[stripped]);
        continue;
      }

      if (transliterateCache.has(token)) {
        result.push(transliterateCache.get(token)!);
        continue;
      }

      // Call Google Input Tools Phonetic Transliteration
      try {
        const url = `https://inputtools.google.com/request?text=${encodeURIComponent(token)}&itc=bn-t-i0-und&num=1`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data[0] === "SUCCESS" && data[1]?.[0]?.[1]?.[0]) {
          const bnWord = data[1][0][1][0];
          transliterateCache.set(token, bnWord);
          result.push(bnWord);
        } else {
          result.push(token);
        }
      } catch {
        result.push(token);
      }
    }
    translatedParts.push(result.join(" "));
  }

  const output = translatedParts.join(", ");
  transliterateCache.set(text, output);
  return output;
};
