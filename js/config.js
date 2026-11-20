/* =====================================================================
   MOCHI SITE SETTINGS
   ---------------------------------------------------------------------
   This is the ONE file you edit for links, email and photo captions.
   Rules:
   - Keep the quotes '...' around every value.
   - Links must start with https://
   - Leave a url as '' (empty) to hide that item from the site.
   ===================================================================== */

window.MOCHI_CONFIG = {

  siteName: 'Mochi the Menace',

  /* ---------- Social profiles (shown on About page + footer) -------- */
  social: [
    {
      id: 'instagram',
      label: 'Instagram',
      handle: '@mochi_the_menace',
      url: 'https://www.instagram.com/_mochi_the_menace_?jplx=NWVkaGltaWQwNDNj&utm_source=qr'
    },
    {
      id: 'facebook',
      label: 'Facebook',
      handle: 'Mochi the Menace',
      url: '' // ✏️ paste Mochi's Facebook page link, e.g. 'https://www.facebook.com/yourpage'
    },
    {
      id: 'youtube',
      label: 'YouTube',
      handle: 'Mochi the Menace',
      url: '' // ✏️ paste Mochi's YouTube channel link, e.g. 'https://www.youtube.com/@yourchannel'
    }
  ],

  /* ---------- Affiliate links (About page) ---------------------------
     name : what the product is
     note : one line on why you like it
     url  : your affiliate link (leave '' to hide the item)
     code : optional discount code, or ''                              */
  affiliates: [
    {
      name: 'Everyday harness',
      note: 'The one Mochi cannot wriggle out of. We tried.',
      url: 'https://www.instagram.com/_mochi_the_menace_?jplx=NWVkaGltaWQwNDNj&utm_source=qr', // ✏️
      code: ''
    },
    {
      name: 'Slow-feeder bowl',
      note: 'Turned five-second dinners into actual meals.',
      url: '', // ✏️
      code: ''
    },
    {
      name: 'Favorite chew toy',
      note: 'Has survived the menace longer than any other toy.',
      url: '', // ✏️
      code: ''
    }
  ],

  affiliateDisclosure:
    'Some links here are affiliate links. If you buy through them, Mochi may earn a small ' +
    'commission at no extra cost to you. We only share things we actually use.',

  /* ---------- "Ask Mochi's mom" question form (Diet page) ------------
     Option A (recommended): a free Formspree form.
       1. Sign up at https://formspree.io and create a form.
       2. Paste its endpoint below, e.g. 'https://formspree.io/f/abcdwxyz'
     Option B: leave formEndpoint empty and set contactEmail. The form
       will open the visitor's email app with their question filled in.  */
  formEndpoint: '', // ✏️
  contactEmail: '', // ✏️ e.g. 'askmochismom@gmail.com'

  /* ---------- Photo book + videos (Home page) ------------------------
     Put photos in  assets/images/  named mochi1.jpg, mochi2.jpg, mochi3.jpg ...
     Put videos in  assets/videos/  named mochi1.mp4, mochi2.mp4 ...
     The site finds them automatically. Don't skip more than 4 numbers in a row. */
  gallery: {
    filePrefix: 'mochi',
    coverPhoto: 1, // which photo goes on the book cover and profile picture

    // Optional captions. The number matches the file: 1 = moch1.jpg
    captions: {
      1: 'Day one. Already plotting.',
      2: 'Innocent until proven guilty.'
      // 3: 'Your caption here',
    },

    // Optional captions for videos. 1 = videos/moch1.mp4
    videoCaptions: {
      // 1: 'Zoomies, live',
    },

    imageExtensions: ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'JPEG', 'PNG'],
    videoExtensions: ['mp4', 'MP4', 'mov', 'MOV', 'webm'],
    maxItems: 200,
    stopAfterMissing: 5
  }
};
