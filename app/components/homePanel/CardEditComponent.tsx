import React from 'react';

type CardEditProps = {
    // Accept any identifiers or initial data you need later
    cardId?: string;
};

const CardEditComponent: React.FC<CardEditProps> = ({ cardId }) => {
    return (
        <div>
            <h2>Edit Credit Card</h2>
            <p>WIP — form coming soon. Card ID: {cardId ?? '<unknown>'}</p>
        </div>
    );
};

export default CardEditComponent;