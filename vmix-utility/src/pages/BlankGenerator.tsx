import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Checkbox,
  FormControlLabel,
  Slider,
  Alert
} from '@mui/material';

const BlankGenerator = () => {
  const [transparent, setTransparent] = useState(false);
  const [count, setCount] = useState(1);
  const [generated, setGenerated] = useState(false);

  const handleTransparentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTransparent(event.target.checked);
  };

  const handleCountChange = (_event: Event, newValue: number | number[]) => {
    setCount(newValue as number);
  };

  const handleGenerate = () => {
    // In a real application, this would generate actual blank inputs in vMix
    // This would be where you'd make the actual API call to vMix
    console.log(`Generated ${count} blank${count !== 1 ? 's' : ''} with transparent=${transparent}`);
    
    // Show success message
    setGenerated(true);
    
    // Hide success message after 3 seconds
    setTimeout(() => {
      setGenerated(false);
    }, 3000);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Blank Generator
      </Typography>
      
      {generated && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Successfully generated {count} blank{count !== 1 ? 's' : ''} with {transparent ? 'transparent' : 'solid'} background!
        </Alert>
      )}
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Generate Blank Inputs
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={transparent}
                onChange={handleTransparentChange}
                color="primary"
              />
            }
            label="Transparent Background"
          />
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Typography id="blank-count-slider" gutterBottom>
            Number of Blanks to Generate: {count}
          </Typography>
          <Slider
            value={count}
            onChange={handleCountChange}
            aria-labelledby="blank-count-slider"
            valueLabelDisplay="auto"
            step={1}
            marks
            min={1}
            max={10}
          />
        </Box>
        
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleGenerate}
        >
          Generate Blanks
        </Button>
      </Paper>
    </Box>
  );
};

export default BlankGenerator;