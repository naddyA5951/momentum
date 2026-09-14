import {useCallback, useState} from 'react';

export function useNotifications(){
 const [enabled,setEnabled]=useState(()=>window.Notification?.permission==='granted');
 const ping=useCallback(()=>{try{const c=new AudioContext(),o=c.createOscillator(),g=c.createGain();o.frequency.value=660;g.gain.setValueAtTime(.08,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.4);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+.4)}catch{}},[]);
 const request=async()=>{if(!window.Notification)return false;const granted=(await window.Notification.requestPermission())==='granted';setEnabled(granted);return granted};
 const notify=useCallback((title,body,{vibrate=false}={})=>{ping();if(vibrate&&navigator.vibrate)navigator.vibrate([220,120,220,120,400]);if(window.Notification?.permission==='granted')new window.Notification(title,{body,icon:'/momentum-icon.svg',badge:'/momentum-icon.svg',vibrate:vibrate?[220,120,220,120,400]:undefined})},[ping]);
 return {enabled,request,notify};
}
