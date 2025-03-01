// src/components/NavigationSidebar.js
import React from 'react';
import { Card, CardContent, List, ListItem, ListItemButton, ListItemText } from '@mui/material';

const NavigationSidebar = ({ selectedTab, onSelectTab, tabs }) => {
  return (
    <Card variant="outlined">
      <CardContent>
        <List>
          {tabs.map((text) => (
            <ListItem key={text} disablePadding>
              <ListItemButton selected={selectedTab === text} onClick={() => onSelectTab(text)}>
                <ListItemText primary={text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};

export default NavigationSidebar;
