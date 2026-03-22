import { App, PluginSettingTab, Setting, debounce } from "obsidian";
import type CanvasMindMapPlugin from "./main";

export interface MindMapSettings {
	autoLayout: boolean;
	autoColor: boolean;
	horizontalGap: number;
	verticalGap: number;
	defaultNodeWidth: number;
	defaultNodeHeight: number;
	maxNodeHeight: number;
	defaultMindmapMode: boolean;
	navigationZoomPadding: number;
}

export const DEFAULT_SETTINGS: MindMapSettings = {
	autoLayout: true,
	autoColor: true,
	horizontalGap: 80,
	verticalGap: 20,
	defaultNodeWidth: 300,
	defaultNodeHeight: 60,
	maxNodeHeight: 300,
	defaultMindmapMode: true,
	navigationZoomPadding: 200,
};

export class MindMapSettingTab extends PluginSettingTab {
	plugin: CanvasMindMapPlugin;

	constructor(app: App, plugin: CanvasMindMapPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const debouncedSave = debounce(async () => {
			await this.plugin.saveSettings();
		}, 500);

		new Setting(containerEl)
			.setName("Default mindmap mode")
			.setDesc("Whether canvases default to mindmap mode (can be toggled per canvas)")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.defaultMindmapMode)
					.onChange(async (value) => {
						this.plugin.settings.defaultMindmapMode = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auto-layout")
			.setDesc("Automatically arrange nodes after adding/deleting")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoLayout)
					.onChange(async (value) => {
						this.plugin.settings.autoLayout = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auto-color branches")
			.setDesc("Assign distinct colors to top-level branches")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoColor)
					.onChange(async (value) => {
						this.plugin.settings.autoColor = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Horizontal gap")
			.setDesc("Space between parent and child nodes (px)")
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.horizontalGap))
					.onChange((value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.horizontalGap = num;
							debouncedSave();
						}
					})
			);

		new Setting(containerEl)
			.setName("Vertical gap")
			.setDesc("Space between sibling nodes (px)")
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.verticalGap))
					.onChange((value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.verticalGap = num;
							debouncedSave();
						}
					})
			);

		new Setting(containerEl)
			.setName("Default node width")
			.setDesc("Width of newly created nodes (px)")
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.defaultNodeWidth))
					.onChange((value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.defaultNodeWidth = num;
							debouncedSave();
						}
					})
			);

		new Setting(containerEl)
			.setName("Default node height")
			.setDesc("Height of newly created nodes (px)")
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.defaultNodeHeight))
					.onChange((value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.defaultNodeHeight = num;
							debouncedSave();
						}
					})
			);

		new Setting(containerEl)
			.setName("Max node height")
			.setDesc("Maximum height a node can grow to before scrolling (px)")
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.maxNodeHeight))
					.onChange((value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.maxNodeHeight = num;
							debouncedSave();
						}
					})
			);

		new Setting(containerEl)
			.setName("Navigation zoom padding")
			.setDesc("Extra space around the target node when zooming after navigation (px). 0 = tight zoom.")
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.navigationZoomPadding))
					.onChange((value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 0) {
							this.plugin.settings.navigationZoomPadding = num;
							debouncedSave();
						}
					})
			);
	}
}
