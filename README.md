# Disease Dynamics Lab — GitHub Pages package

This folder contains the three files needed to publish the educational simulator as a static GitHub Pages site.

## Files
- `index.html` — page structure and controls
- `styles.css` — visual styling and responsive layout
- `sim.js` — simulation logic, chart, and CSV export

## Publish with GitHub Pages
1. Create a repository under your GitHub account. A public repository works with GitHub Free.
2. Upload these three files directly into the repository's top level (not inside another folder).
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Choose branch **main** and folder **/(root)**, then click **Save**.
6. Wait for the published URL shown in the Pages section. It will look like `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

## Canvas or Squarespace embed
After the page is published, use the public URL in an iframe. Example:
`<iframe src="https://YOUR-USERNAME.github.io/REPOSITORY-NAME/" title="Disease Dynamics Lab" width="100%" height="900" style="border:0;" loading="lazy"></iframe>`

Canvas may restrict iframe embeds depending on institution settings. If the iframe is removed by the editor, ask your Canvas administrator about approved external-tool or iframe domains.

## Model note
This is a simplified classroom demonstration, not a validated epidemiological forecasting model. Preset names are illustrative comparisons, not calibrated disease forecasts.
