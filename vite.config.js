import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    base: "/habit-tracker/",
    plugins: [
        VitePWA({
            registerType: "autoUpdate",
            manifest: {
                name: "pawsome habit tracker",
                short_name: "habits",
                theme_color: "#160f1c",
                background_color: "#160f1c",
                display: "standalone",
                icons: [
                    {
                        src: "icon-192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "icon-512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                ],
            },
        }),
    ],
});
