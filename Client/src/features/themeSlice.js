// FOLLO AUDIT
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    theme: "light",
};

const themeSlice = createSlice({
    name: "theme",
    initialState,
    reducers: {
        toggleTheme: (state) => {
            const theme = state.theme === "light" ? "dark" : "light";
            localStorage.setItem("theme", theme);
            // FOLLO AUDIT — DOM side-effect kept here for simplicity; guarded for SSR safety.
            // Ideally this should be moved to a middleware or dispatched as a side-effect in the component.
            if (typeof document !== 'undefined') {
                document.documentElement.classList.toggle("dark");
            }
            state.theme = theme;
        },
        setTheme: (state, action) => {
            state.theme = action.payload;
        },
        loadTheme: (state) => {
            const theme = localStorage.getItem("theme");
            if (theme) {
                state.theme = theme;
                // FOLLO AUDIT — guarded for SSR safety
                if (theme === "dark" && typeof document !== 'undefined') {
                    document.documentElement.classList.add("dark");
                }
            }
        },
    },
});

export const { toggleTheme, setTheme, loadTheme } = themeSlice.actions;
export default themeSlice.reducer;