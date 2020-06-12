const puppeteer = require('puppeteer');
const randomUseragent = require('random-useragent');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');

const email = process.env.EMAIL;
const password = process.env.PASSWORD;

const csvWriter = createCsvWriter({
  path: 'out.csv',
  header: [
    { id: 'domain', title: 'Domain' },
    { id: 'viewcount', title: 'Viewcount' }
  ]
});
// USER SUGGESTIONS:
// This app will crawl a list of csv files fromatted from SEMrush to scan the viewcounts as provided by siteprice.com
//The app is set to take a file called data.csv on line 25, and output a new csv with views over 500k on line 8.
//Sometimes siteprice.com will refuse more searches, in which case the code will catch, and write everything it's logged so far. It's suggested to have another csv to copy this info to.
// If this type of error happens, you can find the line number in your data.csv file, and specify the index in the for loop on line 79 to pick up where you left off.
//Occasionally the browser crashes due to a bug on the google login. Stopping the program and restarting it will get you into a proper google login.
//For obvious reasons, I have removed my login info from this script. You will need to input a google account of your own on lines 62 and 68 (nut)
const siteData = [];

const login = "https://siteprice.com/";

fs.createReadStream('data.csv')
  .pipe(csv())
  .on('data', (row) => {
    siteData.push(row);
    //console.log(row);
  })
  .on('end', () => {
    (async () => {
      const browser = await puppeteer.launch({ headless: false });
      const page = await browser.newPage();
      var domainData = [];

      browser.on('disconnected', () => {
        console.log("Browswer closed manually");
        console.log("Logging current data to csv file.");
        csvWriter
          .writeRecords(domainData)
          .then(() => console.log(domainData));
      });
      console.log('CSV file successfully processed');
      console.log("Inner print:" + siteData[0].Domain);

      // setUserAgent tells the website that we aren't bots.... EVEN THOUGH WE ARE!!! 
      await page.setUserAgent(randomUseragent.getRandom());

      // Opens webpage
      await page.goto(login);

      // Waits for the sign in link to appear before moving forward
      await page.waitFor('#collapse-menu > ul > li:nth-child(5) > a');
      await page.click("#collapse-menu > ul > li:nth-child(5) > a");
      await page.waitFor("#signin > div > div > form > div.modal-footer > button");
      await page.waitFor("#signin > div > div > form > div.modal-body > div.form-group.connect-with > a.connect.google");

      //Fills the inputs with our username and password
      const form = await page.$("#signin > div > div > form > div.modal-body > div.form-group.connect-with > a.connect.google")
      await form.evaluate(form => form.click());

      // Waits for google login and enters the e-mail, then submits
      await page.waitFor("input[type=email]")
        .catch(err => {
          page.screenshot({ path: 'error.png' });
          console.log(err);
        })

        //You will need to input your google email here
      await page.$eval('input[type=email]', el => el.value = "YOUR GOOGLE EMAIL");
      await page.$eval("input[type=submit]", el => el.click())
        .catch(err => { console.log(page.evaluate(() => document.body.innerHTML)) });

      // Waits for and submits password
      await page.waitFor('input[type=password]');
      // You will need to input your google password here.
      await page.$eval('input[type=password]', el => el.value = "YOUR GOOGLE PASSWORD");
      await page.$eval("input[type=submit]", el => el.click())
        .catch(err => { page.screenshot({ path: 'login.png' }) });

      // Tells our program to automatically close alert boxes
      page.on('dialog', async dialog => {
        await dialog.accept();
      });

      // LOOPS OVER THE CSV FROM THIS POINT FORWARD

      for (index = 0; index < siteData.length; index++) {
        // Fills out the search bar with our domain
        var alert = false;
        var invalidBadge = false;

        var domain = siteData[index].Domain;
        await page.waitFor('input[type=text]')
          .catch(async () => {
            console.log("Failed the first home page load, trying a second. Will write to csv if page fails to load.")
            await page.goto(login)
            await page.waitFor('input[type=text]')
              .catch(async () => {
                console.log("Website failed to load twice. App failure at csv file index #" + index);
                console.log("Logging current data to csv file.");
                csvWriter
                  .writeRecords(domainData)
                  .then(async () => {
                    console.log(domainData)
                    await page.close()
                  });
              })
          }
          );
        await page.$eval('input[type=text]', (el, domain) => el.value = domain, domain);
        await page.$eval(".btn", el => el.click());


        console.log("Waiting for load animation to end for domain: " + domain);
        await page.waitFor(() => !document.querySelector("#preloader"))
          .catch(() => {
            console.log("Error on the animation")
            alert = true
          })

        if (alert) {
          await page.goto(login)
            .catch(async () => {
              console.log("Failed to load home page, trying once more");
              await page.goto(login)
                .catch(() => {
                  console.log("Failed to load homepage again. Logging data and closing out crawler")
                });
            })
          await page.waitFor('input[type=text]')
            .catch(async () => {
              console.log("Website failed to load twice. App failure at csv file index #" + index);
              console.log("Logging current data to csv file and closing.");
              csvWriter
                .writeRecords(domainData)
                .then(async () => {
                  console.log(domainData)
                  await page.close();
                });
            })
          continue;
        }

        await page.waitForSelector("span.badge.bg-blue", { timeout: 60000 })
          .catch(err => {
            console.log(domainData)
            console.log("Badge with view value never appeared");
          })

        // Grabs the number from the badge and pushes it to an array
        var badgeValue = await page.$eval("#newcontent > div > div:nth-child(3) > div > div > div.box-body > table > tbody > tr:nth-child(3) > td:nth-child(2) > span", (element => element.textContent))
          .catch(err => {
            invalidBadge = true;
            console.log("Can't evaluate badge, moving onto next iteration");
          });

        if (invalidBadge) {
          console.log("Loading in home page");
          await page.goto(login);
          continue;
        }

        console.log(domain + " has a view amount of" + parseInt(badgeValue.replace(/[^0-9]/g, '')));
        if (parseInt(badgeValue.replace(/[^0-9]/g, '')) >= 1000000)
          domainData.push({ domain: domain, viewcount: parseInt(badgeValue.replace(/[^0-9]/g, '')) });

        // Clicks back to the homepage to restart the loop
        await page.goto(login);
      }

      csvWriter
        .writeRecords(domainData)
        .then(() => console.log(domainData));

    })();
  });




