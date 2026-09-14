import {Canvas, useFrame} from '@react-three/fiber';
import {Float, Stars} from '@react-three/drei';
import {useRef} from 'react';
function Core({active}){const group=useRef();useFrame((_,d)=>{if(group.current){group.current.rotation.y+=d*(active?1.1:.15);group.current.rotation.x+=d*(active?.3:.05)}});return <group ref={group}><mesh><icosahedronGeometry args={[1.6,2]}/><meshBasicMaterial color={active?'#c4b5fd':'#5eead4'} wireframe transparent opacity={.42}/></mesh><mesh rotation={[.8,.2,0]}><torusGeometry args={[2.25,.018,12,80]}/><meshBasicMaterial color="#a78bfa"/></mesh><pointLight color="#8b5cf6" intensity={active?20:5} distance={8}/></group>}
export function CoreCanvas({active}){return <div className="canvas"><Canvas camera={{position:[0,0,6]}}><Stars radius={30} depth={15} count={700} factor={2} saturation={0}/><Float speed={active?4:1.2} rotationIntensity={.2}><Core active={active}/></Float><ambientLight intensity={1}/></Canvas></div>}
