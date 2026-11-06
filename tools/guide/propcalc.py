import math,numpy as np
# sezione (x,s) con s=-z
bt=math.radians(25);u=np.array([math.cos(bt),math.sin(bt)]);n=np.array([-u[1],u[0]])
AU,AL,BU,BL=[np.array(p) for p in ([22.45,11.02],[22.87,10.11],[-22.87,-10.11],[-22.45,-11.02])]
def arc(a,b,R,side):
    m=(a+b)/2;d=b-a;L=np.linalg.norm(d);t=d/L;N=np.array([-t[1],t[0]]);N=N if N.dot(side)>0 else -N
    h=math.sqrt(R*R-L*L/4);c=m-N*h
    return c,R
cu,_=arc(AU,BU,60,n);cl,_=arc(AL,BL,90,n)
sec=lambda x,s:(((x-cu[0])**2+(s-cu[1])**2)<=3600)&(((x-cl[0])**2+(s-cl[1])**2)>=8100)&(((x-AU[0])*n[1]-(s-AU[1])*n[0])*0+1>0)
# area sezione con griglia
h=.01;xx,ss=np.meshgrid(np.arange(-24,24,h),np.arange(-14,16,h))
# limita alle corde laterali: dentro le due rette AU-AL e BU-BL
along=xx*u[0]+ss*u[1]
inS=sec(xx,ss)&(abs(along)<=25.02)&(((xx-cl[0])**2+(ss-cl[1])**2)>=8100)
print('area sezione griglia',inS.sum()*h*h,'programma 115,20')
t=inS.sum(axis=0)*h;X=xx[0]
# contorno in (x,y)
y0=10;y1=95.5;R=82;hh=(y1-y0)/2;cx=8-(R-(R-math.sqrt(R*R-hh*hh)))  # centro a sinistra
cx=8-math.sqrt(R*R-hh*hh)
print('larghezza max',cx+R)
Rt=None
# arco di punta tangente
dirx,diry=-(95.5-50+2.25-0)*0,0
cy=(y0+y1)/2
d=np.array([8-cx,y1-cy])/R;tang=np.array([-d[1],d[0]])
# cerchio per (8,y1) tangente a tang e simmetrico: centro (0,yc)
nor=np.array([-tang[1],tang[0]]);k=-8/nor[0];yc=y1+k*nor[1];rt=abs(k);print('punta yc',yc,'r',rt,'cima',yc+rt)
def ytop(x):
    a=abs(x);r=np.zeros_like(a)
    side=np.sqrt(np.maximum(R*R-(a-cx)**2,0))+cy
    tip=yc+np.sqrt(np.maximum(rt*rt-a*a,0))
    return np.where(a<8,tip,side)
def ybot(x):
    a=abs(x);side=cy-np.sqrt(np.maximum(R*R-(a-cx)**2,0))
    return np.where(a<8,y0,side)
ok=abs(X)<=cx+R
H=np.where(ok,ytop(X)-ybot(X),0);H=np.maximum(H,0)
Vb=np.sum(H*t)*h;print('V pala sagomata',Vb,'programma 8023.2')
# parte dentro il mozzo r<15 da togliere
Vin=0
for i,x in enumerate(X):
    if ok[i] and abs(x)<15 and t[i]>0:
        top=min(ytop(np.array([x]))[0],math.sqrt(225-x*x));b=ybot(np.array([x]))[0]
        if top>b:Vin+=(top-b)*t[i]*h
print('dentro mozzo',Vin)
Vm=math.pi*225*30;print('con mozzo',Vm+3*(Vb-Vin))
Vf=Vm+3*(Vb-Vin)-math.pi*25*30;print('con foro passante',Vf)
ch=.5*1.5**2*2*math.pi*(15-.5);print('smusso',ch,'finale',Vf-ch,'massa PLA g',(Vf-ch)/1000*1.24)
