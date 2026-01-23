import React from 'react';

const HeroImage = () => {
  return (
    <div className='w-full h-full flex justify-center items-center overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800'>
      <img 
        src='https://imagedelivery.net/LqiWLm-3MGbYHtFuUbcBtA/119580eb-abd9-4191-b93a-f01938786700/public' 
        alt='Hostinger Horizons'
        className='w-full h-full object-contain'
      />
    </div>
  );
};

export default HeroImage;
