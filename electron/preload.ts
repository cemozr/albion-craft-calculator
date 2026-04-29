import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  fetchPrices: (itemIds: string[], locations: string[], quality: number) =>
    ipcRenderer.invoke("fetch-prices", itemIds, locations, quality),

  fetchItems: () => ipcRenderer.invoke("fetch-items"),

  fetchRecipes: () => ipcRenderer.invoke("fetch-recipes"),

  clearCache: () => ipcRenderer.invoke("clear-cache"),

  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
});
