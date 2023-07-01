/*!
    * Start Bootstrap - SB Admin v7.0.5 (https://startbootstrap.com/template/sb-admin)
    * Copyright 2013-2022 Start Bootstrap
    * Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-sb-admin/blob/master/LICENSE)
    */
    // 
// Scripts
// 

window.addEventListener('DOMContentLoaded', event => {

    // Toggle the side navigation
    const sidebarToggle = document.body.querySelector('#sidebarToggle');
    if (sidebarToggle) {
        // Uncomment Below to persist sidebar toggle between refreshes
        // if (localStorage.getItem('sb|sidebar-toggle') === 'true') {
        //     document.body.classList.toggle('sb-sidenav-toggled');
        // }
        sidebarToggle.addEventListener('click', event => {
            event.preventDefault();
            document.body.classList.toggle('sb-sidenav-toggled');
            localStorage.setItem('sb|sidebar-toggle', document.body.classList.contains('sb-sidenav-toggled'));
        });
    }

});

const shareButton=document.querySelector('.sh-button');
const overlay=document.querySelector('.overlay');
const shareModal=document.querySelector('.share');
const closeShare=document.querySelector('.closeShare');



const link = encodeURI(window.location.href);
const msg = encodeURIComponent('Hey, I found this article');
const title = encodeURIComponent('Article or Post Title Here');
const fb = document.querySelector('.facebook');
fb.href = `https://www.facebook.com/share.php?u=${link}`;
const twitter = document.querySelector('.twitter');
twitter.href = `http://twitter.com/share?&url=${link}&text=${msg}&hashtags=javascript,programming`;
const linkedIn = document.querySelector('.linkedin');
linkedIn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${link}`;
const reddit = document.querySelector('.reddit');
reddit.href = `http://www.reddit.com/submit?url=${link}&title=${title}`;
const whatsapp = document.querySelector('.whatsapp');
whatsapp.href = `https://api.whatsapp.com/send?text=${msg}: ${link}`;
const telegram = document.querySelector('.telegram');
telegram.href = `https://telegram.me/share/url?url=${link}&text=${msg}`;

const copy=document.querySelector(".copy");
copy.addEventListener('click',()=>{
    navigator.clipboard.writeText(link);
    alert("Copied to clipboard" );
})

shareButton.addEventListener('click',()=>{
    // var pos = $(this).offset();
    // shareModal.offset( pos );
    // if (navigator.share) {
    //   // Browser supports native share api
    //   navigator.share({
    //     text: 'Please read this great article: ',
    //     url: location.href
    //   }).then(() => {
    //     console.log('Thanks for sharing!');
    //   })
    // }else{
        overlay.classList.add('show-share');
        shareModal.classList.add('show-share');
    // }
})

overlay.addEventListener('click',()=>{
    overlay.classList.remove('show-share');
    shareModal.classList.remove('show-share');
})

closeShare.addEventListener('click',()=>{
    overlay.classList.remove('show-share');
    shareModal.classList.remove('show-share');
})

