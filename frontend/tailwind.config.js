/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Màu dùng riêng cho 4 mức cảnh báo tương đồng đề tài (Chương 2, mục 2.1.5)
        warning: {
          normal: "#16a34a",     // xanh   0-50%
          review: "#eab308",     // vàng   50-70%
          high: "#f97316",       // cam    70-85%
          duplicate: "#dc2626",  // đỏ     >85%
        },
      },
    },
  },
  plugins: [],
};
