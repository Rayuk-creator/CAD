import math,json,sys
def gear(m,z,alpha=20):
    a=math.radians(alpha);r=m*z/2;ra=r+m;rf=r-1.25*m;rb=r*math.cos(a)
    d=math.pi/(2*z)+a  # angolo di T dall'asse Y
    T=(rb*math.sin(d),rb*math.cos(d));rho=r*math.sin(a)
    def on(R):
        # intersezione del cerchio raggio rho centro T col cerchio raggio R, dalla parte dell'asse Y
        D=rb;x=(D*D-rho*rho+R*R)/(2*D);h=math.sqrt(R*R-x*x)
        ux,uy=T[0]/D,T[1]/D
        p=(x*ux-h*uy*-1*-1, x*uy+h*ux)  # ruota verso sinistra (x minore)
        return p
    return dict(m=m,z=z,r=r,ra=ra,rf=rf,rb=rb,rho=rho,T=T,on=on,delta=math.degrees(d))
if __name__=='__main__':
    g=gear(2,20);print({k:v for k,v in g.items() if k!='on'})
    for R in (g['rf'],g['rb'],g['r'],g['ra'],g['ra']+1):
        p=g['on'](R);print(R,p,math.hypot(p[0]-g['T'][0],p[1]-g['T'][1]),math.degrees(math.atan2(p[0],p[1])))
    # scostamento dall'evolvente vera, r da rb a ra
    rb=g['rb'];T=g['T'];inv=lambda t:math.tan(t)-t
    th0=math.pi/(2*g['z'])+inv(math.radians(20))  # angolo (da Y) dell'origine dell'evolvente del fianco destro
    mx=0
    for i in range(201):
        R=rb+(g['ra']-rb)*i/200
        t=math.acos(rb/R);ang=th0-inv(t)
        # punto vero
        x,y=R*math.sin(ang),R*math.cos(ang)
        e=abs(math.hypot(x-T[0],y-T[1])-g['rho'])
        if e>mx:mx=e;wr=R
    print('scostamento max',mx,'a r',wr)
