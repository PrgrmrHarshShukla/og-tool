# Instructions to run the program

- npm install
- npx playwright install
  

## Then one of these commands to run it:

node index.js
=> Will scrape everything


node index.js https://interviewing.io/blog
=> Will scrape blog only


node index.js https://interviewing.io/learn https://interviewing.io/guides
=> Will scrape interview guides and company guides


node index.js C:/Users/your-username/Downloads/Aline_Book.pdf
=> Will scrape PDF

node index.js https://unknownsite.com/blog/some-cool-article
=> Will scrape the URL using the generic scraper setup in interviewing-io-blog.js file


## The output will get stored in a json file.
