// Placeholder for future offline support.
// Not registered anywhere yet.

// Change this to your repository name
var GHPATH = '/holycrm-frontend-static';
 
// Choose a different app prefix name
var APP_PREFIX = 'holycrmwa_';
 
// The version of the cache. Every time you change any of the files
// you need to change this version (version_01, version_02…). 
// If you don't change the version, the service worker will give your
// users the old files!
var VERSION = 'version_00';
 
// The files to make available for offline use. make sure to add 
// others to this list
var URLS = [    
  `${GHPATH}/`,
  `${GHPATH}/login.html`
  `${GHPATH}/index.html`,
  `${GHPATH}/css/styles.css`,
  `${GHPATH}/js/app.js`
  `${GHPATH}/js/auth.js`
  `${GHPATH}/js/events.js`
  `${GHPATH}/js/groups.js`
  `${GHPATH}/js/locations.js`
  `${GHPATH}/js/login.js`
  `${GHPATH}/js/members.js`
  `${GHPATH}/js/ministries.js`
  `${GHPATH}/js/permissions_ui.js`
  `${GHPATH}/js/permissions.js`
  `${GHPATH}/js/pocketbase.umd.js`
  `${GHPATH}/js/users.js`
]