import "@/plugins/axios";
import { createHead } from "@vueuse/head";
import { createPinia } from "pinia";
import { createApp } from "vue";
import { DialogPlugin } from "@/plugins/dialog";
import { GumPlugin } from "@/plugins/gum";
import { PulsePlugin } from "@/plugins/pulse";
import App from "./App.vue";
import router from "./router";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "@/assets/scss/custom.scss";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

import Dropdown from "bootstrap/js/dist/dropdown";

const app = createApp(App);
const pinia = createPinia();
const head = createHead({ titleTemplate: (title) => (title ? `${title} | Analyser` : "Analyser") });

app.directive("bs-dropdown", {
  mounted(el) {
    try {
      new Dropdown(el);
    } catch {}
  },
  unmounted(el) {
    try {
      const instance = Dropdown.getInstance(el);
      if (instance) instance.dispose();
    } catch {}
  }
});

app.use(pinia);
app.use(router);
app.use(head);
app.use(DialogPlugin);
app.use(GumPlugin);
app.use(PulsePlugin);
app.mount("#app");

