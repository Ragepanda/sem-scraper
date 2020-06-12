# sem-scraper
This app takes an input of a csv file filled with links of competitors (gathered from SEMrush) of a chosen website. This app then takes those competitors and navigates to siteprice.com, a website that offers view counts that are far more accurate than SEM rush, but requires navigation to an individual page and a wait time for siteprice to gather the information. This tool was developed as a means to remove the need to manually gather this data by instead using Puppeteer to navigate the pages individually and output this information to a csv. 

Our marketing team was able to use this scraped data to rank/prioritize which websites needed to be markted to, with the aim of them joining our company's ad network. 

In order to use this tool, you can provide your own data.csv file with links you want to get precise monthly viewcounts for, and you will also need to input your personal google information at lines 73 and 81 of the index.js file. To launch the app, run the index.js in node and let it run.

Edit: This app currently is broken due to advertising changes to siteprice.com. 
